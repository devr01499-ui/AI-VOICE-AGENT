/**
 * Model Context Protocol (MCP) Service
 *
 * Facilitates dynamic tool discovery and tool execution across external MCP servers
 * over HTTP or SSE JSON-RPC endpoints. Converts MCP tool definitions to Gemini functionDeclarations.
 */

import { logger } from '../utils/logger';

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  transport: 'sse' | 'http';
  apiKey?: string;
}

export interface DiscoveredMcpTool {
  name: string;
  description: string;
  parameters?: Record<string, any>;
  serverUrl: string;
  transport: 'sse' | 'http';
  apiKey?: string;
}

export class McpService {
  /**
   * Connect to configured MCP servers and discover available tools via JSON-RPC tools/list
   */
  static async fetchMcpTools(servers: MCPServerConfig[]): Promise<{
    functionDeclarations: any[];
    mcpToolMap: Map<string, DiscoveredMcpTool>;
  }> {
    const functionDeclarations: any[] = [];
    const mcpToolMap = new Map<string, DiscoveredMcpTool>();

    if (!servers || !Array.isArray(servers) || servers.length === 0) {
      return { functionDeclarations, mcpToolMap };
    }

    for (const server of servers) {
      if (!server.url) continue;

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'Claritiy-Voice-MCP-Client/1.0',
        };
        if (server.apiKey) {
          headers['Authorization'] = `Bearer ${server.apiKey}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(server.url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'mcp-tools-list',
            method: 'tools/list',
            params: {},
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          logger.warn(`McpService: Failed to fetch tools from ${server.name} (${server.url}) - HTTP ${response.status}`);
          continue;
        }

        const data: any = await response.json();
        const tools: Array<{ name: string; description?: string; inputSchema?: any }> =
          data?.result?.tools || data?.tools || [];

        for (const tool of tools) {
          const toolName = `mcp_${server.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}_${tool.name}`;
          const declaration = {
            name: toolName,
            description: tool.description || `MCP Tool ${tool.name} provided by ${server.name}`,
            parameters: tool.inputSchema || {
              type: 'OBJECT',
              properties: {},
            },
          };

          functionDeclarations.push(declaration);
          mcpToolMap.set(toolName, {
            name: tool.name,
            description: tool.description || '',
            parameters: tool.inputSchema,
            serverUrl: server.url,
            transport: server.transport,
            apiKey: server.apiKey,
          });
        }

        logger.info(`McpService: Discovered ${tools.length} tool(s) from MCP server "${server.name}"`);
      } catch (err: any) {
        logger.warn(`McpService: Error connecting to MCP server "${server.name}" (${server.url})`, {
          error: err.message || String(err),
        });
      }
    }

    return { functionDeclarations, mcpToolMap };
  }

  /**
   * Execute an MCP tool by calling the target MCP server's tools/call JSON-RPC endpoint
   */
  static async executeMcpTool(
    discoveredTool: DiscoveredMcpTool,
    args: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Claritiy-Voice-MCP-Client/1.0',
      };
      if (discoveredTool.apiKey) {
        headers['Authorization'] = `Bearer ${discoveredTool.apiKey}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(discoveredTool.serverUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `mcp-call-${Date.now()}`,
          method: 'tools/call',
          params: {
            name: discoveredTool.name,
            arguments: args || {},
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from MCP server`);
      }

      const data: any = await response.json();

      if (data.error) {
        return {
          error: true,
          message: data.error.message || 'MCP tool execution failed',
        };
      }

      const content = data?.result?.content;
      if (Array.isArray(content)) {
        const textResult = content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n');
        return { result: textResult || content };
      }

      return { result: data?.result || data };
    } catch (err: any) {
      logger.error(`McpService: Failed to execute MCP tool "${discoveredTool.name}"`, {
        error: err.message || String(err),
        serverUrl: discoveredTool.serverUrl,
      });
      return {
        error: true,
        message: `MCP execution error: ${err.message || String(err)}`,
      };
    }
  }
}
