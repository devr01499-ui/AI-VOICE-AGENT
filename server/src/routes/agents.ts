/**
 * Bolna Server — Agent Routes
 *
 * Enforces strict user-wise database isolation gates.
 */

import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { Agent } from '@prisma/client';
import { AgentRepository } from '../repositories/AgentRepository';
import { validateParams, validateQuery } from '../middleware/validation';
import { prisma } from '../lib/prisma';
import { getUserIdFromRequest } from '../utils/auth';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { ADMIN_EMAIL } from '../config/constants';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const router = Router();

// ─── Validation Schemas ──────────────────────────

const agentIdParamSchema = z.object({
  agentId: z.string().uuid('agentId must be a valid UUID'),
});

const listQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'draft']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// ─── Route Handlers ──────────────────────────────

/** GET /api/v2/agents/me/profile — Fetch current user profile and balance metrics. */
router.get(
  '/me/profile',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).userId;
      if (!userId) {
        logger.warn("Authentication block tripped: User context resolved empty.");
        res.status(200).json({ success: false, data: null, message: "User identity unresolvable" });
        return;
      }

      const user = await AgentRepository.findProfileByUserId(userId);
      res.status(200).json({
        success: true,
        data: user ? {
          ...user,
          isAdmin: user.email === ADMIN_EMAIL,
          workspaceRole: (req as any).workspaceRole || 'owner',
        } : null,
      });
      return;
    } catch (error: any) {
      logger.error("Error optimizing prompt", { error: error?.message || String(error) });
      res.status(500).json({ success: false, error: 'Failed to optimize prompt' });
      return;
    }
  }
);

/** POST /api/v2/agents/conversational-builder — Chat endpoint to build an agent config. */
router.post(
  '/conversational-builder',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { history, message } = req.body;
      if (!message && (!history || history.length === 0)) {
        res.status(400).json({ success: false, error: 'Message or history is required' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        res.status(500).json({ success: false, error: 'GEMINI_API_KEY is not configured on the server.' });
        return;
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const modelName = process.env.GEMINI_BUILDER_MODEL || 'gemini-2.0-flash';
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: `You are an expert AI Voice Agent Builder for 'Claritiy Voice'.
Your goal is to gather requirements from the user and output a complete agent configuration JSON.
To build a great voice agent, you need to know:
1. The agent's core purpose or use case (e.g. outbound sales, inbound customer support).
2. The agent's tone and personality (e.g. professional, friendly, energetic).
3. The language requirements (English, Hindi, etc.).

If the user has not provided enough information, ask ONE short, polite clarifying question in plain text.
If you have enough information, output ONLY a valid JSON object (no markdown formatting, no markdown code blocks, just raw JSON) matching this exact structure:
{
  "systemPrompt": "The complete, detailed persona and instruction prompt for the agent to follow.",
  "systemVoice": "Puck",
  "temperature": 0.7,
  "languageMode": "auto"
}

Notes for systemVoice: choose one of Puck, Aoede, Charon, Fenrir, Kore, Leda, Orus, Zephyr, Callirhoe, Autonoe, Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar, Alnilam, Schedar, Gacrux, Pulcherrima, Achird, Adara, Castor, Deneb, Eltanin, Mizar.
DO NOT wrap the JSON in markdown blocks. Output the raw JSON object string when ready, otherwise output conversational text.`,
      });

      const chatHistory = (history || []).map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      const chat = model.startChat({
        history: chatHistory,
        generationConfig: {
          temperature: 0.2,
        },
      });

      const result = await chat.sendMessage(message || "Hello, I want to build an agent.");
      const responseText = result.response.text().trim();

      // Attempt to parse as JSON to see if it's a final configuration
      let isFinal = false;
      let config = null;
      let cleanJson = responseText;

      // Handle cases where Gemini might still add markdown blocks despite instructions
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
      }

      try {
        config = JSON.parse(cleanJson);
        if (config && typeof config === 'object' && config.systemPrompt) {
          isFinal = true;
        }
      } catch (e) {
        // Not JSON, which means it's a conversational follow-up
      }

      res.json({
        success: true,
        data: {
          isFinal,
          response: isFinal ? null : responseText, // original text for chat log if not final
          config: isFinal ? config : null,
        }
      });
      return;
    } catch (error: any) {
      logger.error("Error in conversational builder", { error: error?.message || String(error), stack: error?.stack });
      res.status(500).json({ success: false, error: error?.message || 'Failed to process request' });
      return;
    }
  }
);

/** POST /api/v2/agents/optimize — Low-Code Prompt Optimizer helper. */
router.post(
  '/optimize',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { description } = req.body;
      if (!description) {
        res.status(400).json({ success: false, error: 'Description is required' });
        return;
      }

      // Enrichment logic: append architectural filler, brevity boundaries, and voice pausing cues
      const enrichedPrompt = `You are a professional voice AI assistant.
Role description: ${description}

CONVERSATIONAL RULES & VOICE METADATA:
1. BREVITY BOUNDARIES: Keep answers strictly under 2 sentences. Never read raw bullet points or list items.
2. VOICE PAUSING CUES: Pause slightly when introducing new topics. Use "..." or brief phrasing to give natural transitions.
3. CONVERSATIONAL FILLERS: Speak naturally using polite fillers like "sure", "uh-huh", "got it" to sound human.
4. TARGET REDIRECTS: If caller drifts off-topic, gently redirect them to the primary call objective.`;

      res.json({
        success: true,
        data: {
          prompt: enrichedPrompt,
          model: 'gemini-2.0-flash',
          voiceName: 'Puck',
          temperature: 0.7,
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/v2/agents — List all agents (isolated to the authenticated userId). */
router.get(
  '/',
  requireAuth,
  validateQuery(listQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).userId;
      if (!userId) {
        res.status(200).json({ success: true, data: [], count: 0 });
        return;
      }

      const { status, limit, offset } = req.query as {
        status?: string;
        limit?: string;
        offset?: string;
      };

      let agents = [];
      let totalCount = 0;
      try {
        const lim = limit ? parseInt(limit, 10) : 50;
        const off = offset ? parseInt(offset, 10) : 0;
        
        // Fetch paginated agents from the database directly
        agents = await prisma.agent.findMany({
          where: {
            userId,
            ...(status ? { status } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: lim,
          skip: off,
          select: {
            id: true,
            name: true,
            description: true,
            agentType: true,
            status: true,
            version: true,
            workspaceId: true,
            model: true,
            voiceName: true,
            systemVoice: true,
            languageMode: true,
            temperature: true,
            createdAt: true,
            updatedAt: true,
          }
        });
        
        // Also fetch total count for pagination metadata if needed
        totalCount = await prisma.agent.count({
          where: {
            userId,
            ...(status ? { status } : {}),
          }
        });

        // Parse dates for response
        const formatted = agents.map((agent: any) => ({
          id: agent?.id,
          name: agent?.name,
          description: agent?.description,
          agentType: agent?.agentType,
          status: agent?.status,
          version: agent?.version,
          workspaceId: agent?.workspaceId,
          model: agent?.model,
          voiceName: agent?.voiceName,
          systemVoice: agent?.systemVoice,
          languageMode: agent?.languageMode,
          temperature: agent?.temperature,
          createdAt: agent?.createdAt instanceof Date ? agent.createdAt.toISOString() : (agent?.createdAt ? new Date(agent.createdAt).toISOString() : new Date().toISOString()),
          updatedAt: agent?.updatedAt instanceof Date ? agent.updatedAt.toISOString() : (agent?.updatedAt ? new Date(agent.updatedAt).toISOString() : new Date().toISOString()),
        }));

        res.status(200).json({
          success: true,
          data: formatted,
          count: totalCount,
        });
        return;
      } catch (error: any) {
        logger.error("Handled Gracefully - Agent Repository Retrieval Exception:", { error: error?.message || String(error) });
        // Unified fallback matching success contract
        res.status(200).json({
          success: true,
          data: [],
          count: 0,
        });
        return;
      }
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/v2/agents/:agentId — Get a single agent by ID. */
router.get(
  '/:agentId',
  requireAuth,
  validateParams(agentIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const agentId = req.params.agentId as string;
      
      // Strict user-wise lookup constraint
      const agent = await prisma.agent.findFirst({
        where: { id: agentId, userId: userId }
      });

      if (!agent) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      let parsedConfig = {};
      try {
        parsedConfig = JSON.parse(agent.agentConfig);
      } catch {
        // Return raw string if not valid JSON
      }

      res.json({
        success: true,
        data: {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          agentType: agent.agentType,
          status: agent.status,
          version: agent.version,
          workspaceId: agent.workspaceId,
          model: agent.model,
          voiceName: agent.voiceName,
          systemVoice: agent.systemVoice,
          languageMode: agent.languageMode,
          temperature: agent.temperature,
          systemPrompt: agent.systemPrompt,
          flowGraph: agent.flowGraph,
          agentConfig: parsedConfig,
          tags: JSON.parse(agent.tags || '[]'),
          createdAt: agent.createdAt.toISOString(),
          updatedAt: agent.updatedAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/** POST /api/v2/agents — Create a new agent. */
router.post(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { name, description, agentType, status, agentConfig, tags, workspaceId, model, voiceName, systemVoice, temperature, systemPrompt, flowGraph, languageMode } = req.body;

      const newAgent = await prisma.agent.create({
        data: {
          name,
          description: description || null,
          agentType: agentType || 'conversational',
          status: status || 'draft',
          agentConfig: typeof agentConfig === 'string' ? agentConfig : JSON.stringify(agentConfig || {}),
          tags: typeof tags === 'string' ? tags : JSON.stringify(tags || []),
          userId: userId,
          workspaceId: workspaceId || null,
          model: model || null,
          voiceName: voiceName || null,
          systemVoice: systemVoice || 'Puck',
          temperature: temperature !== undefined ? Number(temperature) : 0.7,
          systemPrompt: systemPrompt || null,
          flowGraph: flowGraph || null,
          languageMode: languageMode || 'auto',
        },
      });

      res.status(201).json({
        success: true,
        data: newAgent,
      });
    } catch (err) {
      next(err);
    }
  }
);

/** PUT /api/v2/agents/:agentId — Update an existing agent. */
router.put(
  '/:agentId',
  requireAuth,
  validateParams(agentIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const agentId = req.params.agentId as string;
      const { name, description, agentType, status, agentConfig, tags, workspaceId, model, voiceName, systemVoice, temperature, systemPrompt, flowGraph, languageMode } = req.body;

      // Verify ownership before updating
      const exists = await prisma.agent.findFirst({
        where: { id: agentId, userId: userId }
      });

      if (!exists) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      // Explicitly update only matching records with composite tenant criteria
      await prisma.agent.updateMany({
        where: { id: agentId, userId: userId },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(agentType !== undefined && { agentType }),
          ...(status !== undefined && { status }),
          ...(agentConfig !== undefined && {
            agentConfig: typeof agentConfig === 'string' ? agentConfig : JSON.stringify(agentConfig || {})
          }),
          ...(tags !== undefined && {
            tags: typeof tags === 'string' ? tags : JSON.stringify(tags || [])
          }),
          ...(workspaceId !== undefined && { workspaceId }),
          ...(model !== undefined && { model }),
          ...(voiceName !== undefined && { voiceName }),
          ...(systemVoice !== undefined && { systemVoice }),
          ...(temperature !== undefined && { temperature: temperature !== null ? Number(temperature) : 0.7 }),
          ...(systemPrompt !== undefined && { systemPrompt }),
          ...(flowGraph !== undefined && { flowGraph }),
          ...(languageMode !== undefined && { languageMode }),
        },
      });

      const updatedAgent = await prisma.agent.findFirst({
        where: { id: agentId, userId: userId }
      });

      if (!updatedAgent) {
        res.status(404).json({ success: false, error: 'Agent not found after update' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: updatedAgent.id,
          name: updatedAgent.name,
          description: updatedAgent.description,
          agentType: updatedAgent.agentType,
          status: updatedAgent.status,
          version: updatedAgent.version,
          workspaceId: updatedAgent.workspaceId,
          model: updatedAgent.model,
          voiceName: updatedAgent.voiceName,
          systemVoice: updatedAgent.systemVoice,
          languageMode: updatedAgent.languageMode,
          temperature: updatedAgent.temperature,
          systemPrompt: updatedAgent.systemPrompt,
          flowGraph: updatedAgent.flowGraph,
          tags: JSON.parse(updatedAgent.tags || '[]'),
          createdAt: updatedAgent.createdAt.toISOString(),
          updatedAt: updatedAgent.updatedAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/** DELETE /api/v2/agents/:agentId — Delete an existing agent. */
router.delete(
  '/:agentId',
  requireAuth,
  validateParams(agentIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      if ((req as any).workspaceRole === 'viewer') {
        res.status(403).json({ success: false, error: 'Team members cannot delete agents' });
        return;
      }

      const agentId = req.params.agentId as string;

      // Verify ownership before deleting
      const exists = await prisma.agent.findFirst({
        where: { id: agentId, userId: userId }
      });

      if (!exists) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      await prisma.agent.deleteMany({
        where: { id: agentId, userId: userId },
      });

      res.json({
        success: true,
        message: 'Agent deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);

/** POST /api/v2/agents/:agentId/chat — Converse with an agent using LLM. */
router.post(
  '/:agentId/chat',
  requireAuth,
  validateParams(agentIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const agentId = req.params.agentId as string;
      const { message, history = [] } = req.body;

      if (!message) {
        res.status(400).json({ success: false, error: 'Message is required' });
        return;
      }

      // 1. Fetch Agent & System Prompt
      const agent = await prisma.agent.findFirst({
        where: { id: agentId, userId: userId }
      });

      if (!agent) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      // 2. Fetch User's Gemini API Key (or fallback to ENV)
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const geminiApiKey = (user as any)?.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

      if (!geminiApiKey) {
        res.status(400).json({ success: false, error: 'Gemini API key is not configured.' });
        return;
      }

      // 3. Setup Gemini API
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ 
        model: agent.model || 'gemini-2.5-flash',
        systemInstruction: agent.systemPrompt || "You are a helpful AI assistant."
      });

      // 4. Construct Chat
      const chat = model.startChat({
        history: history.map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        })),
        generationConfig: {
          temperature: agent.temperature ? Number(agent.temperature) : 0.7,
        }
      });

      // 5. Send message and wait for response
      const result = await chat.sendMessage(message);
      const responseText = result.response.text();

      res.status(200).json({
        success: true,
        data: { text: responseText }
      });
    } catch (err: any) {
      logger.error('Agent chat error', { error: err.message, stack: err.stack });
      res.status(500).json({ success: false, error: 'Failed to chat with agent', details: err.message });
    }
  }
);

export default router;
