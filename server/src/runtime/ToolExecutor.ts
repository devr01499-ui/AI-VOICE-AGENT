/**
 * Bolna Voice Runtime Engine — Tool Executor
 *
 * Registry-based tool execution framework. Tools are registered by
 * {@link ToolDefinition} and dispatched to the appropriate handler
 * based on `executionType`. Every invocation is timed and returns
 * a uniform {@link ToolCallResult}.
 *
 * Supported execution types:
 *  - `http`      — fetch with configurable method/URL
 *  - `webhook`   — POST-only fetch to a webhook URL
 *  - `database`  — placeholder (not yet implemented)
 *  - `builtin`   — placeholder (not yet implemented)
 */

import { logger } from '../utils/logger';
import { AppError } from '../types/errors';
import type { ToolDefinition, ToolCallResult } from '../types';

// ─────────────────────────────────────────────
// Executor Class
// ─────────────────────────────────────────────

/**
 * Manages tool registration and execution.
 *
 * Usage:
 * ```ts
 * const executor = new ToolExecutor();
 * executor.registerTool(myToolDef);
 * const result = await executor.executeTool('myTool', { key: 'value' });
 * ```
 */
export class ToolExecutor {
  /** Tool definitions keyed by name. */
  private readonly registry: Map<string, ToolDefinition> = new Map();

  // ── Registration ────────────────────────────

  /**
   * Registers a single tool definition.
   *
   * @param toolDef - The tool to register.
   * @throws {AppError} If a tool with the same name is already registered.
   */
  registerTool(toolDef: ToolDefinition): void {
    if (this.registry.has(toolDef.name)) {
      throw new AppError(
        409,
        'TOOL_CONFLICT',
        `Tool '${toolDef.name}' is already registered`,
      );
    }

    this.registry.set(toolDef.name, toolDef);

    logger.info('ToolExecutor: tool registered', {
      name: toolDef.name,
      executionType: toolDef.executionType,
    });
  }

  /**
   * Registers multiple tool definitions in sequence.
   *
   * @param tools - Array of {@link ToolDefinition} objects.
   */
  registerTools(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  // ── Execution ───────────────────────────────

  /**
   * Executes a registered tool and returns a standardised result.
   *
   * Dispatches to the handler matching the tool's `executionType`,
   * measures elapsed time, and wraps the outcome in a {@link ToolCallResult}.
   *
   * @param toolName   - The registered name of the tool.
   * @param parameters - Key-value parameters forwarded to the handler.
   * @returns A promise resolving to a {@link ToolCallResult}.
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, unknown>,
  ): Promise<ToolCallResult> {
    const tool = this.registry.get(toolName);
    if (!tool) {
      return {
        toolName,
        parameters,
        result: null,
        durationMs: 0,
        success: false,
        error: `Tool '${toolName}' is not registered`,
      };
    }

    const startTime = performance.now();

    try {
      const result = await this.dispatch(tool, parameters);
      const durationMs = Math.round(performance.now() - startTime);

      logger.info('ToolExecutor: tool executed successfully', {
        toolName,
        durationMs,
      });

      return {
        toolName,
        parameters,
        result,
        durationMs,
        success: true,
      };
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      const errorMessage = err instanceof Error ? err.message : 'Unknown execution error';

      logger.error('ToolExecutor: tool execution failed', {
        toolName,
        durationMs,
        error: errorMessage,
      });

      return {
        toolName,
        parameters,
        result: null,
        durationMs,
        success: false,
        error: errorMessage,
      };
    }
  }

  // ── Lookup Helpers ──────────────────────────

  /**
   * Returns the definition for a registered tool, or `undefined`.
   *
   * @param toolName - The registered name of the tool.
   */
  getTool(toolName: string): ToolDefinition | undefined {
    return this.registry.get(toolName);
  }

  /**
   * Returns all currently registered tool definitions.
   */
  listTools(): ToolDefinition[] {
    return Array.from(this.registry.values());
  }

  /**
   * Removes all tools from the registry.
   */
  clearRegistry(): void {
    this.registry.clear();

    logger.info('ToolExecutor: registry cleared');
  }

  // ── Private Dispatch ────────────────────────

  /**
   * Routes execution to the handler matching the tool's `executionType`.
   */
  private async dispatch(
    tool: ToolDefinition,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    switch (tool.executionType) {
      case 'http':
        return this.executeHttpTool(tool, params);
      case 'webhook':
        return this.executeWebhookTool(tool, params);
      case 'database':
        return this.executeDatabaseTool(tool, params);
      case 'builtin':
        return this.executeBuiltinTool(tool, params);
      default:
        throw new AppError(
          400,
          'UNSUPPORTED_TOOL_TYPE',
          `Unsupported execution type: ${String(tool.executionType)}`,
        );
    }
  }

  // ── HTTP Handler ────────────────────────────

  /**
   * Executes an HTTP tool by sending a request to the configured URL.
   *
   * Uses `tool.config.url` as the endpoint and `tool.config.method`
   * (defaults to `POST`) as the HTTP method. Parameters are sent as
   * a JSON body.
   *
   * @param tool   - The tool definition containing HTTP config.
   * @param params - Parameters forwarded as the request body.
   * @returns Parsed JSON response.
   */
  private async executeHttpTool(
    tool: ToolDefinition,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const url = tool.config.url;
    if (typeof url !== 'string') {
      throw new AppError(
        400,
        'TOOL_CONFIG_ERROR',
        `HTTP tool '${tool.name}' is missing a valid 'url' in config`,
      );
    }

    const method =
      typeof tool.config.method === 'string' ? tool.config.method.toUpperCase() : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new AppError(
        502,
        'TOOL_HTTP_ERROR',
        `HTTP tool '${tool.name}' returned status ${response.status}`,
      );
    }

    return (await response.json()) as unknown;
  }

  // ── Webhook Handler ─────────────────────────

  /**
   * Executes a webhook tool by POSTing to the configured webhook URL.
   *
   * @param tool   - The tool definition containing webhook config.
   * @param params - Parameters forwarded as the request body.
   * @returns Parsed JSON response.
   */
  private async executeWebhookTool(
    tool: ToolDefinition,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const webhookUrl = tool.config.webhookUrl;
    if (typeof webhookUrl !== 'string') {
      throw new AppError(
        400,
        'TOOL_CONFIG_ERROR',
        `Webhook tool '${tool.name}' is missing a valid 'webhookUrl' in config`,
      );
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new AppError(
        502,
        'TOOL_WEBHOOK_ERROR',
        `Webhook tool '${tool.name}' returned status ${response.status}`,
      );
    }

    return (await response.json()) as unknown;
  }

  // ── Placeholder Handlers ────────────────────

  /**
   * Placeholder for database-type tool execution.
   * Returns a stub result until the database executor is implemented.
   */
  private async executeDatabaseTool(
    tool: ToolDefinition,
    _params: Record<string, unknown>,
  ): Promise<unknown> {
    logger.warn('ToolExecutor: database execution type is not yet implemented', {
      toolName: tool.name,
    });

    return { message: `Database tool '${tool.name}' execution is not yet implemented` };
  }

  /**
   * Placeholder for builtin-type tool execution.
   * Returns a stub result until built-in handlers are registered.
   */
  private async executeBuiltinTool(
    tool: ToolDefinition,
    _params: Record<string, unknown>,
  ): Promise<unknown> {
    logger.warn('ToolExecutor: builtin execution type is not yet implemented', {
      toolName: tool.name,
    });

    return { message: `Builtin tool '${tool.name}' execution is not yet implemented` };
  }
}
