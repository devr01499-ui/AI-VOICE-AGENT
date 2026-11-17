/**
 * Secrets inside an agent's config (webhook signing secret, MCP server API keys).
 *
 * - Stored encrypted (AES-256-GCM via EncryptionService), never in plain text.
 * - Never sent back to the browser: responses carry SECRET_MASK instead.
 * - When the editor saves and sends the mask back unchanged, the stored secret is kept.
 * - Server code that needs the real value calls revealSecret().
 */
import { EncryptionService } from './EncryptionService';

export const SECRET_MASK = '••••••••';

type Cfg = Record<string, any>;

function seal(incoming: unknown, stored: unknown): string | undefined {
  if (incoming === undefined || incoming === null) return undefined;
  if (typeof incoming !== 'string') return undefined;
  if (incoming === SECRET_MASK) {
    return typeof stored === 'string' && stored ? (EncryptionService.isEncrypted(stored) ? stored : EncryptionService.encrypt(stored)) : undefined;
  }
  const value = incoming.trim();
  if (!value) return undefined;
  return EncryptionService.isEncrypted(value) ? value : EncryptionService.encrypt(value);
}

/**
 * Returns a copy of `incoming` with its secrets encrypted. A masked value keeps the stored secret.
 * Call this on the config that is about to be saved, with the config currently in the database.
 */
export function sealAgentSecrets(incoming: Cfg, stored: Cfg): Cfg {
  const out: Cfg = { ...incoming };
  if (out.webhooks && typeof out.webhooks === 'object') {
    const secret = seal(out.webhooks.secret, stored?.webhooks?.secret);
    out.webhooks = { ...out.webhooks };
    if (secret) out.webhooks.secret = secret; else delete out.webhooks.secret;
  }
  if (Array.isArray(out.mcpServers)) {
    const storedServers: any[] = Array.isArray(stored?.mcpServers) ? stored.mcpServers : [];
    out.mcpServers = out.mcpServers.map((server: any) => {
      if (!server || typeof server !== 'object') return server;
      const previous = storedServers.find((s) => s && s.id && s.id === server.id);
      const apiKey = seal(server.apiKey, previous?.apiKey);
      const copy = { ...server };
      if (apiKey) copy.apiKey = apiKey; else delete copy.apiKey;
      return copy;
    });
  }
  return out;
}

/** Returns a copy safe to send to the browser: every secret replaced by SECRET_MASK. */
export function maskAgentSecrets(config: unknown): unknown {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return config;
  const out: Cfg = { ...(config as Cfg) };
  if (out.webhooks && typeof out.webhooks === 'object' && out.webhooks.secret) {
    out.webhooks = { ...out.webhooks, secret: SECRET_MASK };
  }
  if (Array.isArray(out.mcpServers)) {
    out.mcpServers = out.mcpServers.map((s: any) => (s && typeof s === 'object' && s.apiKey ? { ...s, apiKey: SECRET_MASK } : s));
  }
  return out;
}

/** The real value of a stored secret (decrypts; plain legacy values pass through). */
export function revealSecret(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value || value === SECRET_MASK) return undefined;
  return EncryptionService.decryptIfEncrypted(value) || undefined;
}
