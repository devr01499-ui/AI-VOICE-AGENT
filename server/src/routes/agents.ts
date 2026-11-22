/**
 * Claritiy Voice Server — Agent Routes
 *
 * Enforces strict user-wise database isolation gates.
 */

import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AgentRepository } from '../repositories/AgentRepository';
import { validateParams, validateQuery } from '../middleware/validation';
import { prisma } from '../lib/prisma';
import { requireAuth, requireEditor } from '../middleware/auth';
import { requireActivePlanOrBYOK, requireAgentQuota } from '../middleware/planValidation';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../utils/auditLogger';
import { ADMIN_EMAIL } from '../config/constants';
import { QaController } from '../controllers/QaController';
import { detectIndustry, normalizeIndustryInput } from '../utils/systemInstructionBuilder';
import { aiFeatureLimiter, agentWriteLimiter } from '../middleware/rateLimiter';
import { sealAgentSecrets, maskAgentSecrets } from '../utils/agentSecrets';
import { TextModelError, generateText, sanitizeChatHistory } from '../services/ai/textModel';
import { enhancePrompt, PromptCoachEnhanceRequestSchema, PromptCoachInputError } from '../services/PromptCoachService';
import { runTestLab, listTestLabRuns, getTestLabRun, TestLabInputError } from '../services/TestLabService';
import { routingConfigProblem } from '../runtime/callRouting';

const router = Router();

// ─── Agent tags (audit #160) ─────────────────────
// Clients may send tags as an array, a JSON array string or "a, b" text. They used to be stored
// as sent and JSON.parse'd on every read, so a plain string made create answer 500 and the agent
// impossible to open. Store a JSON array always; read old rows safely.
function tagList(raw: unknown): string[] {
  let items: unknown[] = [];
  if (Array.isArray(raw)) items = raw;
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      items = Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
      items = raw.split(',');
    }
  }
  return [...new Set(items.map((t) => String(t ?? '').trim()).filter(Boolean).map((t) => t.slice(0, 60)))].slice(0, 50);
}
const storeTags = (raw: unknown): string => JSON.stringify(tagList(raw));

// ─── Validation Schemas ──────────────────────────

const agentIdParamSchema = z.object({
  agentId: z.string().uuid('agentId must be a valid UUID'),
});

const listQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'draft']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
});

/**
 * Body schema for creating/updating an agent. Every field is optional (partial updates), but each
 * one that is present must be valid. Unknown extra fields (e.g. welcome-message helpers read by
 * normalizeGreetingConfig) pass through untouched. `userId`, `version` and `workspaceId` are
 * never taken from the client.
 */
const MAX_CONFIG_BYTES = 1_000_000;
const MAX_FLOW_BYTES = 2_000_000;
const jsonSized = (max: number) => z.union([z.string(), z.record(z.unknown())]).refine(
  (v) => (typeof v === 'string' ? v : JSON.stringify(v)).length <= max,
  { message: `is too large (limit ${Math.round(max / 1000)} KB)` },
);
export const agentBodySchema = z.object({
  name: z.string().max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  agentType: z.enum(['prompt', 'conversational', 'single-prompt']).optional(),
  status: z.enum(['active', 'inactive', 'draft', 'paused']).optional(),
  agentConfig: z.union([jsonSized(MAX_CONFIG_BYTES), z.null()]).optional(),
  tags: z.union([z.string().max(4000), z.array(z.string().max(60)).max(50)]).optional(),
  model: z.string().max(120).nullable().optional(),
  voiceName: z.string().max(60).regex(/^[A-Za-z0-9 _.-]*$/, 'has invalid characters').nullable().optional(),
  systemVoice: z.string().max(60).regex(/^[A-Za-z0-9 _.-]*$/, 'has invalid characters').nullable().optional(),
  // Stored with the agent; live calls use a fixed temperature (LIVE_CALL_TEMPERATURE, audit #143).
  temperature: z.union([
    z.number().min(0).max(2),
    z.string().regex(/^\d+(\.\d+)?$/).transform(Number).pipe(z.number().min(0).max(2)),
    z.null(),
  ]).optional(),
  systemPrompt: z.string().max(60_000).nullable().optional(),
  firstMessage: z.string().max(2000).nullable().optional(),
  flowGraph: z.union([jsonSized(MAX_FLOW_BYTES), z.null()]).optional(),
  languageMode: z.string().max(40).optional(),
  direction: z.enum(['inbound', 'outbound', 'both']).optional(),
  isPiiRedactionEnabled: z.boolean().optional(),
  industry: z.string().max(40).optional(),
}).passthrough();

function validateAgentBody(req: Request, res: Response, next: NextFunction): void {
  const parsed = agentBodySchema.safeParse(req.body || {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    res.status(400).json({ success: false, error: `Invalid agent data: ${issue.path.join('.') || 'body'} ${issue.message}` });
    return;
  }
  next();
}

/** Parses a stored or incoming agentConfig (object or JSON string) into an object. */
function configObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch { /* unreadable: treat as empty */ }
  }
  return {};
}

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
          isAdmin: user.accountType === 'admin' || user.email === ADMIN_EMAIL,
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
  requireEditor,
  aiFeatureLimiter,
  requireActivePlanOrBYOK,
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

      let responseText = '';

      const systemInstruction = `You are an expert AI Voice Agent Builder for 'Claritiy Voice'.
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
Notes for languageMode: choose one of auto, en, hi, bn, kn, ml, gu, ta, zh, ar matching the user's requested language (e.g. ta for Tamil, hi for Hindi, en for English).
DO NOT wrap the JSON in markdown blocks. Output the raw JSON object string when ready, otherwise output conversational text.`;

      // Shared AI client (audit #155): timeouts, retry, fallback model, the workspace's own key,
      // and errors that never show the provider's text.
      try {
        const out = await generateText({
          workspaceId: userId,
          systemInstruction,
          prompt: String(message || 'Hello, I want to build an agent.').slice(0, 4000),
          history: sanitizeChatHistory(history),
          temperature: 0.2,
          purpose: 'agent-builder',
        });
        responseText = out.text.trim();
      } catch (aiErr) {
        sendTextModelError(res, aiErr, 'The agent builder');
        return;
      }

      // Attempt to parse as JSON to see if it's a final configuration
      let isFinal = false;
      let config = null;
      let cleanJson = responseText;

      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
      }

      if (cleanJson.includes('{') && cleanJson.includes('}')) {
        const firstBrace = cleanJson.indexOf('{');
        const lastBrace = cleanJson.lastIndexOf('}');
        const candidateJson = cleanJson.substring(firstBrace, lastBrace + 1);
        try {
          const parsed = JSON.parse(candidateJson);
          if (parsed && typeof parsed === 'object' && parsed.systemPrompt) {
            config = parsed;
            isFinal = true;
          }
        } catch (e) {
          // Not valid JSON
        }
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
      res.status(500).json({ success: false, error: 'The agent builder failed. Please try again.' });
      return;
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
        res.status(401).json({ success: false, error: 'Unauthorized' });
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
        // Bounded page size (audit #66: any limit was accepted). The dashboard asks for no limit and
        // must see every agent, so the default is the maximum.
        const parsedLimit = parseInt(String(limit ?? ''), 10);
        const lim = Number.isFinite(parsedLimit) ? Math.min(200, Math.max(1, parsedLimit)) : 200;
        const parsedOffset = parseInt(String(offset ?? ''), 10);
        const off = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;
        
        // Fetch paginated agents from the database directly
        agents = await prisma.agent.findMany({
          where: {
            userId,
            // Deleted (archived) agents are hidden; their call history is kept (audit #67).
            ...(status && status !== 'archived' ? { status } : { status: { not: 'archived' } }),
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
            direction: true,
            temperature: true,
            industry: true,
            createdAt: true,
            updatedAt: true,
          }
        });
        
        // Also fetch total count for pagination metadata if needed
        totalCount = await prisma.agent.count({
          where: {
            userId,
            // Deleted (archived) agents are hidden; their call history is kept (audit #67).
            ...(status && status !== 'archived' ? { status } : { status: { not: 'archived' } }),
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
          direction: agent?.direction || 'outbound',
          temperature: agent?.temperature,
          industry: agent?.industry || 'auto',
          detectedIndustry: detectIndustry(agent?.systemPrompt, agent?.name, agent?.flowGraph),
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
        logger.error("Agent list: database error", { error: error?.message || String(error) });
        // A failure is reported as a failure — an empty "success" list made customers think their
        // agents were gone (audit #66).
        res.status(503).json({
          success: false,
          error: 'Your agents could not be loaded right now. Please refresh in a moment.',
        });
        return;
      }
    } catch (err) {
      next(err);
    }
  }
);

// Declared before GET /:agentId: otherwise Express routes /playbooks to the agent handler, whose
// UUID check answers 400 and the playbook list is always empty (audit #43).
/** GET /api/v2/agents/playbooks — List all tested production playbooks */
router.get(
  '/playbooks',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { PLAYBOOKS } = await import('../utils/playbooks');
    res.json({
      success: true,
      data: Object.values(PLAYBOOKS),
    });
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
        where: { id: agentId, userId: userId, status: { not: 'archived' } }
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

      let parsedFlowGraph = null;
      if (agent.flowGraph) {
        try {
          parsedFlowGraph = typeof agent.flowGraph === 'string' ? JSON.parse(agent.flowGraph) : agent.flowGraph;
        } catch {
          parsedFlowGraph = agent.flowGraph;
        }
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
          direction: agent.direction || 'outbound',
          temperature: agent.temperature,
          industry: agent.industry || 'auto',
          detectedIndustry: detectIndustry(agent.systemPrompt, agent.name, agent.flowGraph),
          systemPrompt: agent.systemPrompt,
          firstMessage: agent.firstMessage,
          isPiiRedactionEnabled: Boolean(agent.isPiiRedactionEnabled),
          flowGraph: parsedFlowGraph,
          agentConfig: maskAgentSecrets(parsedConfig),
          tags: tagList(agent.tags),
          createdAt: agent.createdAt.toISOString(),
          updatedAt: agent.updatedAt.toISOString(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export function normalizeCallSettings(incoming: any = {}) {
  return {
    ambientNoise: typeof incoming.ambientNoise === 'string' ? incoming.ambientNoise : 'None',
    endCallToolEnabled: incoming.endCallToolEnabled !== undefined ? Boolean(incoming.endCallToolEnabled) : true,
    endOnGoodbyeEnabled: incoming.endOnGoodbyeEnabled !== undefined ? Boolean(incoming.endOnGoodbyeEnabled) : true,
    closingMessage: typeof incoming.closingMessage === 'string' && incoming.closingMessage.trim()
      ? incoming.closingMessage.trim()
      : 'Thank you for your time. Have a wonderful day!',
    endCallOnSilenceSeconds: typeof incoming.endCallOnSilenceSeconds === 'number'
      ? Math.max(0, Math.min(300, incoming.endCallOnSilenceSeconds))
      : 30,
    maxDurationSeconds: typeof incoming.maxDurationSeconds === 'number'
      ? Math.max(60, Math.min(7200, incoming.maxDurationSeconds))
      : 900,
    voicemailDetection: {
      enabled: Boolean(incoming.voicemailDetection?.enabled),
      action: incoming.voicemailDetection?.action || 'hangup',
    },
    optOutKeywords: Array.isArray(incoming.optOutKeywords)
      ? incoming.optOutKeywords
      : typeof incoming.optOutKeywords === 'string'
      ? incoming.optOutKeywords.split(',').map((k: string) => k.trim()).filter(Boolean)
      : [],
  };
}

function normalizeGreetingConfig(inputConfig: any, body: any): { greeting: any; firstMessage: string | null; config: any } {
  let cfg = typeof inputConfig === 'string'
    ? (() => { try { return JSON.parse(inputConfig); } catch { return {}; } })()
    : { ...(inputConfig || {}) };

  const mode = body.welcomeMessageMode || cfg?.greeting?.mode || (body.firstMessage ? 'agent_first' : 'user_first');
  const text = (typeof body.customWelcomeText === 'string' && body.customWelcomeText.trim())
    ? body.customWelcomeText.trim()
    : (typeof cfg?.greeting?.text === 'string' && cfg.greeting.text.trim())
    ? cfg.greeting.text.trim()
    : (typeof body.firstMessage === 'string' && body.firstMessage.trim())
    ? body.firstMessage.trim()
    : (mode === 'agent_first' ? 'Hello! Thank you for calling Claritiy Voice.' : '');

  const silenceEnabled = body.silenceStartEnabled !== undefined
    ? Boolean(body.silenceStartEnabled)
    : cfg?.greeting?.silenceStart?.enabled !== undefined
    ? Boolean(cfg.greeting.silenceStart.enabled)
    : false;

  const silenceSeconds = body.silenceStartSeconds !== undefined
    ? Math.max(2, Math.min(15, Number(body.silenceStartSeconds) || 4))
    : cfg?.greeting?.silenceStart?.seconds !== undefined
    ? Math.max(2, Math.min(15, Number(cfg.greeting.silenceStart.seconds) || 4))
    : 4;

  const greeting = {
    mode: mode === 'agent_first' ? 'agent_first' : 'user_first',
    text,
    silenceStart: {
      enabled: silenceEnabled,
      seconds: silenceSeconds,
    },
  };

  cfg.greeting = greeting;
  const syncedFirstMessage = (mode === 'agent_first' && text) ? text : null;

  const rawCallSettings = {
    ...(cfg?.callSettings || {}),
    ...(body?.callSettings || {}),
    ...(body?.endCallToolEnabled !== undefined ? { endCallToolEnabled: body.endCallToolEnabled } : {}),
    ...(body?.endOnGoodbyeEnabled !== undefined ? { endOnGoodbyeEnabled: body.endOnGoodbyeEnabled } : {}),
    ...(body?.closingMessage !== undefined ? { closingMessage: body.closingMessage } : {}),
    ...(body?.endCallSilenceSec !== undefined ? { endCallOnSilenceSeconds: Number(body.endCallSilenceSec) } : {}),
    ...(body?.endCallOnSilenceSeconds !== undefined ? { endCallOnSilenceSeconds: Number(body.endCallOnSilenceSeconds) } : {}),
    ...(body?.maxDurationSeconds !== undefined ? { maxDurationSeconds: Number(body.maxDurationSeconds) } : {}),
    ...(body?.maxCallDurationMins !== undefined ? { maxDurationSeconds: Number(body.maxCallDurationMins) * 60 } : {}),
  };
  cfg.callSettings = normalizeCallSettings(rawCallSettings);

  return {
    greeting,
    firstMessage: syncedFirstMessage,
    config: cfg,
  };
}

/** POST /api/v2/agents — Create a new agent. */
router.post(
  '/',
  requireAuth,
  requireEditor,
  agentWriteLimiter,
  validateAgentBody,
  requireAgentQuota,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const primaryUserId = (req as any).user?.id || (req as any).userId;
      let userId = (req as any).effectiveWorkspaceId || primaryUserId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      if ((req as any).workspaceRole === 'viewer') {
        res.status(403).json({ success: false, error: 'Team members cannot create or modify agents' });
        return;
      }

      // Verify userId exists in database to avoid foreign key failure
      const userExists = await prisma.user.findUnique({ where: { id: userId } });
      if (!userExists && primaryUserId) {
        const primaryExists = await prisma.user.findUnique({ where: { id: primaryUserId } });
        if (primaryExists) {
          userId = primaryUserId;
        }
      }

      const {
        name,
        description,
        agentType,
        status,
        agentConfig,
        tags,
        model,
        voiceName,
        systemVoice,
        temperature,
        systemPrompt,
        flowGraph,
        languageMode,
        direction,
        isPiiRedactionEnabled,
        industry,
      } = req.body;

      const safeName = (typeof name === 'string' && name.trim()) ? name.trim() : 'Single-Prompt Agent';
      const parsedTemp = Number(temperature);
      const safeTemp = (temperature !== undefined && temperature !== null && !isNaN(parsedTemp)) ? parsedTemp : 0.7;

      const { firstMessage: syncedFirstMessage, config: normalizedConfig } = normalizeGreetingConfig(agentConfig, req.body);
      // Webhook secret / MCP keys are stored encrypted and never sent back in plain text.
      const finalConfig = sealAgentSecrets(configObject(normalizedConfig), {});
      const routingProblem = routingConfigProblem((finalConfig as any)?.functions, flowGraph);
      if (routingProblem) {
        res.status(400).json({ success: false, error: routingProblem, code: 'VALIDATION_ERROR' });
        return;
      }

      const newAgent = await prisma.agent.create({
        data: {
          name: safeName,
          description: description || null,
          agentType: agentType || 'conversational',
          status: status || 'draft',
          agentConfig: JSON.stringify(finalConfig),
          tags: storeTags(tags),
          userId: userId,
          // workspaceId is never taken from the client (zero client trust).
          workspaceId: null,
          model: model || null,
          voiceName: voiceName || null,
          systemVoice: systemVoice || voiceName || 'Puck',
          temperature: safeTemp,
          systemPrompt: systemPrompt || null,
          firstMessage: syncedFirstMessage,
          flowGraph: typeof flowGraph === 'string' ? flowGraph : flowGraph ? JSON.stringify(flowGraph) : null,
          languageMode: languageMode || 'auto',
          direction: direction || 'outbound',
          isPiiRedactionEnabled: Boolean(isPiiRedactionEnabled),
          // "auto" is no longer offered. New agents get no industry overlay unless one is chosen.
          industry: normalizeIndustryInput(industry) || 'other',
        },
      });

      logAuditEvent({
        workspaceOwnerId: userId,
        actorUserId: primaryUserId || userId,
        action: 'agent.created',
        targetId: newAgent.id,
        metadata: { name: newAgent.name, agentType: newAgent.agentType }
      });

      const qaEvaluation = QaController.runLightweightQaCheck(newAgent.systemPrompt, newAgent.flowGraph);

      let parsedFlow = null;
      try {
        parsedFlow = typeof newAgent.flowGraph === 'string' ? JSON.parse(newAgent.flowGraph) : newAgent.flowGraph;
      } catch {}

      res.status(201).json({
        success: true,
        data: {
          id: newAgent.id,
          name: newAgent.name,
          description: newAgent.description,
          agentType: newAgent.agentType,
          status: newAgent.status,
          version: newAgent.version,
          workspaceId: newAgent.workspaceId,
          model: newAgent.model,
          voiceName: newAgent.voiceName,
          systemVoice: newAgent.systemVoice,
          languageMode: newAgent.languageMode,
          direction: newAgent.direction || 'outbound',
          temperature: newAgent.temperature,
          industry: newAgent.industry || 'auto',
          detectedIndustry: detectIndustry(newAgent.systemPrompt, newAgent.name, newAgent.flowGraph),
          systemPrompt: newAgent.systemPrompt,
          firstMessage: newAgent.firstMessage,
          isPiiRedactionEnabled: Boolean(newAgent.isPiiRedactionEnabled),
          flowGraph: parsedFlow,
          agentConfig: maskAgentSecrets(finalConfig),
          tags: tagList(newAgent.tags),
          qaEvaluation,
          createdAt: newAgent.createdAt.toISOString(),
          updatedAt: newAgent.updatedAt.toISOString(),
        },
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
  requireEditor,
  agentWriteLimiter,
  validateParams(agentIdParamSchema),
  validateAgentBody,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const primaryUserId = (req as any).user?.id || (req as any).userId;
      let userId = (req as any).effectiveWorkspaceId || primaryUserId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      if ((req as any).workspaceRole === 'viewer') {
        res.status(403).json({ success: false, error: 'Team members cannot create or modify agents' });
        return;
      }

      const agentId = req.params.agentId as string;
      const {
        name,
        description,
        agentType,
        status,
        agentConfig,
        tags,
        model,
        voiceName,
        systemVoice,
        temperature,
        systemPrompt,
        firstMessage,
        flowGraph,
        languageMode,
        direction,
        isPiiRedactionEnabled,
        industry,
        welcomeMessageMode,
        customWelcomeText,
        silenceStartEnabled,
        silenceStartSeconds,
      } = req.body;

      // Verify ownership before updating
      let exists = await prisma.agent.findFirst({
        where: { id: agentId, userId: userId, status: { not: 'archived' } }
      });

      if (!exists && primaryUserId && primaryUserId !== userId) {
        exists = await prisma.agent.findFirst({
          where: { id: agentId, userId: primaryUserId, status: { not: 'archived' } }
        });
        if (exists) {
          userId = primaryUserId;
        }
      }

      if (!exists) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      const parsedTemp = Number(temperature);
      const safeTemp = (temperature !== undefined && temperature !== null && !isNaN(parsedTemp)) ? parsedTemp : 0.7;

      let finalConfigToSave: string | undefined = undefined;
      let syncedFirstMessage: string | null | undefined = firstMessage !== undefined
        ? ((typeof firstMessage === 'string' && firstMessage.trim()) ? firstMessage.trim() : null)
        : undefined;

      if (
        agentConfig !== undefined ||
        welcomeMessageMode !== undefined ||
        customWelcomeText !== undefined ||
        silenceStartEnabled !== undefined ||
        silenceStartSeconds !== undefined
      ) {
        // Merge, section by section, onto what is stored: a client that sends only some sections
        // (the flow builder sends only its own) must never wipe the others (webhooks, post-call
        // fields, functions, MCPs, call settings, greeting...). Sending a section replaces it.
        const baseConfig = agentConfig !== undefined
          ? { ...configObject(exists.agentConfig), ...configObject(agentConfig) }
          : exists.agentConfig;
        const normalized = normalizeGreetingConfig(baseConfig, req.body);
        finalConfigToSave = JSON.stringify(sealAgentSecrets(configObject(normalized.config), configObject(exists.agentConfig)));
        syncedFirstMessage = normalized.firstMessage;
      }

      // Transfer numbers, specialist agents and WhatsApp templates are checked on save (server side).
      if (finalConfigToSave !== undefined || flowGraph !== undefined) {
        const routingProblem = routingConfigProblem(
          configObject(finalConfigToSave !== undefined ? finalConfigToSave : exists.agentConfig)?.functions,
          flowGraph !== undefined ? flowGraph : exists.flowGraph,
          { functions: configObject(exists.agentConfig)?.functions, flowGraph: exists.flowGraph },
        );
        if (routingProblem) {
          res.status(400).json({ success: false, error: routingProblem, code: 'VALIDATION_ERROR' });
          return;
        }
      }

      // Explicitly update matching record
      await prisma.agent.updateMany({
        where: { id: agentId, userId: userId },
        data: {
          ...(name !== undefined && { name: (typeof name === 'string' && name.trim()) ? name.trim() : exists.name }),
          ...(description !== undefined && { description }),
          ...(agentType !== undefined && { agentType }),
          ...(status !== undefined && { status }),
          ...(finalConfigToSave !== undefined && { agentConfig: finalConfigToSave }),
          ...(tags !== undefined && {
            tags: storeTags(tags)
          }),
          ...(model !== undefined && { model }),
          ...(voiceName !== undefined && { voiceName, systemVoice: voiceName }),
          ...(systemVoice !== undefined && { systemVoice, voiceName: systemVoice }),
          ...(temperature !== undefined && { temperature: safeTemp }),
          ...(systemPrompt !== undefined && { systemPrompt }),
          ...(syncedFirstMessage !== undefined && { firstMessage: syncedFirstMessage }),
          ...(flowGraph !== undefined && { flowGraph: typeof flowGraph === 'string' ? flowGraph : flowGraph ? JSON.stringify(flowGraph) : null }),
          ...(languageMode !== undefined && { languageMode }),
          ...(direction !== undefined && { direction }),
          ...(isPiiRedactionEnabled !== undefined && { isPiiRedactionEnabled: Boolean(isPiiRedactionEnabled) }),
          // Unknown values and the retired "auto" are ignored, leaving the stored industry unchanged.
          ...(normalizeIndustryInput(industry) && { industry: normalizeIndustryInput(industry) }),
        },
      });

      const updatedAgent = await prisma.agent.findFirst({
        where: { id: agentId, userId: userId }
      });

      if (!updatedAgent) {
        res.status(404).json({ success: false, error: 'Agent not found after update' });
        return;
      }

      logAuditEvent({
        workspaceOwnerId: userId,
        actorUserId: primaryUserId || userId,
        action: 'agent.updated',
        targetId: updatedAgent.id,
        metadata: { name: updatedAgent.name, status: updatedAgent.status, version: updatedAgent.version }
      });

      const qaEvaluation = QaController.runLightweightQaCheck(updatedAgent.systemPrompt, updatedAgent.flowGraph);

      let parsedConfig = {};
      try {
        parsedConfig = typeof updatedAgent.agentConfig === 'string' ? JSON.parse(updatedAgent.agentConfig) : (updatedAgent.agentConfig || {});
      } catch {}

      let parsedFlow = null;
      try {
        parsedFlow = typeof updatedAgent.flowGraph === 'string' ? JSON.parse(updatedAgent.flowGraph) : updatedAgent.flowGraph;
      } catch {}

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
          direction: updatedAgent.direction || 'outbound',
          temperature: updatedAgent.temperature,
          industry: updatedAgent.industry || 'auto',
          detectedIndustry: detectIndustry(updatedAgent.systemPrompt, updatedAgent.name, updatedAgent.flowGraph),
          systemPrompt: updatedAgent.systemPrompt,
          firstMessage: updatedAgent.firstMessage,
          isPiiRedactionEnabled: Boolean(updatedAgent.isPiiRedactionEnabled),
          flowGraph: parsedFlow,
          agentConfig: maskAgentSecrets(parsedConfig),
          tags: tagList(updatedAgent.tags),
          qaEvaluation,
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
  requireEditor,
  agentWriteLimiter,
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
        where: { id: agentId, userId: userId, status: { not: 'archived' } }
      });

      if (!exists) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      // Deleting an agent ARCHIVES it (audit #67). Its calls, transcripts, recordings, reports and
      // batches are business and billing records: Call -> Agent is ON DELETE CASCADE, so removing the
      // row used to erase all of that history from Call History, Reports and Analytics. The agent
      // disappears from every list and can no longer take or place calls.
      await prisma.phoneNumber.updateMany({
        where: { assignedAgentId: agentId, userId },
        data: { assignedAgentId: null }
      }).catch(() => {});

      await prisma.agentKnowledgeBase.deleteMany({
        where: { agentId }
      }).catch(() => {});

      await prisma.inboundConfig.deleteMany({
        where: { agentId }
      }).catch(() => {});

      // Campaigns that have not finished stop (their results so far are kept).
      await prisma.batch.updateMany({
        where: { agentId, userId, status: { in: ['scheduled', 'running', 'paused'] } },
        data: { status: 'cancelled', statusReason: 'Agent deleted' }
      }).catch(() => {});

      // Follow-up calls the agent had booked will not be placed.
      await prisma.scheduledCall.updateMany({
        where: { agentId, status: 'scheduled' },
        data: { status: 'canceled' }
      }).catch(() => {});

      await prisma.agent.updateMany({
        where: { id: agentId, userId: userId },
        data: { status: 'archived' },
      });

      logAuditEvent({
        workspaceOwnerId: userId,
        actorUserId: (req as any).user?.id || userId,
        action: 'agent.deleted',
        targetId: agentId,
        metadata: { name: exists.name, archived: true }
      });

      res.json({
        success: true,
        message: 'Agent deleted. Its call history and reports are kept.',
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
  requireEditor,
  agentWriteLimiter,
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
        where: { id: agentId, userId: userId, status: { not: 'archived' } }
      });

      if (!agent) {
        res.status(404).json({ success: false, error: 'Agent not found' });
        return;
      }

      // 2. Shared AI client (audit #155): the workspace's own key or the platform key, timeouts,
      // retry and the fallback model. agent.model is the VOICE (Live) model, which cannot answer
      // text chat, so the text model list is used.
      const temperature = Number(agent.temperature);
      const out = await generateText({
        workspaceId: userId,
        systemInstruction: agent.systemPrompt || 'You are a helpful AI assistant.',
        prompt: String(message).slice(0, 4000),
        history: sanitizeChatHistory(history),
        temperature: Number.isFinite(temperature) && temperature >= 0 && temperature <= 2 ? temperature : 0.7,
        purpose: 'agent-chat',
      });

      res.status(200).json({
        success: true,
        data: { text: out.text }
      });
    } catch (err: any) {
      // Never return the provider's error text to the customer.
      sendTextModelError(res, err, 'The AI companion');
    }
  }
);

/** POST /api/v2/agents/test-prompt — Fast LLM text test for studio prompt preview */
router.post(
  '/test-prompt',
  requireAuth,
  requireEditor,
  aiFeatureLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).effectiveWorkspaceId || (req as any).user?.id || (req as any).userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { systemPrompt, userQuery, history } = req.body;
      if (!userQuery || typeof userQuery !== 'string' || !userQuery.trim()) {
        res.status(400).json({ success: false, error: 'userQuery is required' });
        return;
      }

      const testModeInstruction = `You are being tested in a live chat preview of a voice agent. Respond with ONLY the next natural spoken turn a real person would say next — one to three sentences, plain conversational language. Never output stage directions, asterisks, markdown formatting, or the entire script at once. If the configured prompt contains an unfilled placeholder like [Clinic Name], substitute a reasonable example value rather than reciting the placeholder literally. Wait for the other person's next message before continuing — this is a back-and-forth conversation, not a monologue.`;

      const combinedSystemInstruction = `${systemPrompt ? `${systemPrompt}\n\n` : ''}TEST PREVIEW INSTRUCTIONS:\n${testModeInstruction}`;

      // Shared AI client (audit #155): timeouts, retry, fallback model, the workspace's own key.
      const out = await generateText({
        workspaceId: userId,
        systemInstruction: combinedSystemInstruction,
        prompt: userQuery.trim().slice(0, 4000),
        history: sanitizeChatHistory(history),
        temperature: 0.7,
        purpose: 'test-llm',
      });

      res.status(200).json({
        success: true,
        data: { reply: out.text },
      });
      return;
    } catch (error: any) {
      sendTextModelError(res, error, 'The test assistant');
      return;
    }
  }
);

/**
 * Maps AI-model failures to clear HTTP answers. Never returns provider error text or keys.
 */
function sendTextModelError(res: Response, err: unknown, feature: string): void {
  if (err instanceof TextModelError) {
    const map: Record<string, [number, string]> = {
      not_configured: [503, `${feature} is not available right now: no AI model is configured. Please contact support.`],
      timeout: [504, `${feature} took too long to answer. Please try again.`],
      rate_limited: [503, `${feature} is busy right now. Please try again in a minute.`],
      unavailable: [503, `${feature} is temporarily unavailable. Please try again shortly.`],
      blocked: [422, `${feature} could not process this text. Please rephrase it and try again.`],
      bad_output: [502, err.message],
    };
    const [status, message] = map[err.kind] || [503, `${feature} is temporarily unavailable.`];
    res.status(status).json({ success: false, error: message, code: `AI_${err.kind.toUpperCase()}` });
    return;
  }
  logger.error(`${feature} failed`, { error: String((err as any)?.message || err) });
  res.status(500).json({ success: false, error: `${feature} failed. Please try again.` });
}

/**
 * POST /api/v2/agents/prompt-coach/enhance — rewrite the customer's own prompt with the AI model.
 * Body: { prompt, goal?, agentName?, direction?, language?, industry? }
 */
router.post(
  '/prompt-coach/enhance',
  requireAuth,
  requireEditor,
  aiFeatureLimiter,
  requireActivePlanOrBYOK,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = PromptCoachEnhanceRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Invalid request. Please send the prompt text to enhance.' });
      return;
    }
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId;
    try {
      const result = await enhancePrompt(workspaceId, parsed.data);
      res.json({ success: true, data: result });
    } catch (err) {
      if (err instanceof PromptCoachInputError) {
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      sendTextModelError(res, err, 'Prompt Coach');
    }
  }
);

/** POST /api/v2/agents/prompt-coach/generate — Generate production prompt from business facts and playbook */
router.post(
  '/prompt-coach/generate',
  requireAuth,
  requireEditor,
  aiFeatureLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { PromptCoachGenerateRequestSchema } = await import('../types/promptCoach');
      const parseResult = PromptCoachGenerateRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: 'Validation error: ' + parseResult.error.errors.map(e => e.message).join(', '),
        });
        return;
      }

      const { playbookId, businessFacts } = parseResult.data;
      if (!businessFacts?.companyName || !businessFacts?.productOrService) {
        res.status(400).json({
          success: false,
          error: 'companyName and productOrService are required business facts',
        });
        return;
      }

      const { generatePlaybookPrompt } = await import('../utils/playbooks');
      const genResult = generatePlaybookPrompt(playbookId, {
        companyName: businessFacts.companyName,
        productOrService: businessFacts.productOrService,
        agentName: businessFacts.agentName || 'Alex',
        coreProblem: businessFacts.coreProblem,
        pricingSummary: businessFacts.pricingSummary,
        targetAudience: businessFacts.targetAudience,
        extraInstructions: businessFacts.extraInstructions,
      });

      res.json({
        success: true,
        data: {
          playbookId: genResult.playbook.id,
          title: genResult.playbook.title,
          prompt: genResult.generatedPrompt,
          generatedPrompt: genResult.generatedPrompt,
          recommendedStyle: genResult.recommendedStyle,
          playbook: genResult.playbook,
          review: genResult.review,
        },
      });
    } catch (err: any) {
      logger.error('Prompt coach generate error', { error: err.message });
      res.status(500).json({ success: false, error: 'Failed to generate prompt from playbook' });
    }
  }
);

const TEST_LAB_ID = /^[A-Za-z0-9-]{1,64}$/;

/**
 * POST /api/v2/agents/:agentId/test-lab — test the agent's SAVED prompt against simulated callers
 * using the AI model, grade the transcripts, save and return the run. Uses AI credits, never call minutes.
 * Body: { personas?: string[] }  (default: all five)
 */
router.post(
  '/:agentId/test-lab',
  requireAuth,
  requireEditor,
  aiFeatureLimiter,
  requireActivePlanOrBYOK,
  async (req: Request, res: Response): Promise<void> => {
    const agentId = String(req.params.agentId);
    if (!TEST_LAB_ID.test(agentId)) {
      res.status(400).json({ success: false, error: 'Invalid agent id' });
      return;
    }
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId;
    try {
      const run = await runTestLab(workspaceId, agentId, req.body?.personas);
      res.json({ success: true, data: run });
    } catch (err) {
      if (err instanceof TestLabInputError) {
        if (err.message === 'AGENT_NOT_FOUND') {
          res.status(404).json({ success: false, error: 'Agent not found in your workspace' });
        } else {
          res.status(400).json({ success: false, error: err.message });
        }
        return;
      }
      sendTextModelError(res, err, 'Test Lab');
    }
  }
);

/** GET /api/v2/agents/:agentId/test-lab/runs — latest saved Test Lab runs (summaries). */
router.get('/:agentId/test-lab/runs', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const agentId = String(req.params.agentId);
  if (!TEST_LAB_ID.test(agentId)) {
    res.status(400).json({ success: false, error: 'Invalid agent id' });
    return;
  }
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId;
    res.json({ success: true, data: await listTestLabRuns(workspaceId, agentId) });
  } catch (err: any) {
    logger.error('Test Lab: failed to list runs', { error: String(err?.message || err) });
    res.status(500).json({ success: false, error: 'Failed to load Test Lab history' });
  }
});

/** GET /api/v2/agents/:agentId/test-lab/runs/:runId — one saved run with transcripts. */
router.get('/:agentId/test-lab/runs/:runId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const agentId = String(req.params.agentId);
  const runId = String(req.params.runId);
  if (!TEST_LAB_ID.test(agentId) || !TEST_LAB_ID.test(runId)) {
    res.status(400).json({ success: false, error: 'Invalid id' });
    return;
  }
  try {
    const workspaceId = (req as any).effectiveWorkspaceId || (req as any).userId;
    const run = await getTestLabRun(workspaceId, agentId, runId);
    if (!run) {
      res.status(404).json({ success: false, error: 'Test Lab run not found' });
      return;
    }
    res.json({ success: true, data: run });
  } catch (err: any) {
    logger.error('Test Lab: failed to load run', { error: String(err?.message || err) });
    res.status(500).json({ success: false, error: 'Failed to load the Test Lab run' });
  }
});

export default router;

