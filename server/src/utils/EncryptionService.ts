import crypto from 'crypto';
import { env } from '../config/env';
import { getWebhookSigningSecret } from './security';
import { logger } from './logger';

let encryptionKeyWarned = false;

/**
 * Service to handle at-rest encryption and decryption using AES-256-GCM.
 * Supports versioned payloads (e.g. "v2:iv:tag:cipher") with ENCRYPTION_KEY as primary source.
 * Decryption automatically falls back across historical key derivations to support lazy migration.
 */
export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly AUTH_TAG_LENGTH = 16;
  private static readonly VERSION_PREFIX = 'v2';
  private static readonly LEGACY_DEFAULT_HEX_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

  /**
   * Returns the primary 32-byte AES key.
   * Priority:
   *   1. env.ENCRYPTION_KEY (Dedicated encryption key)
   *   2. Fallback to getWebhookSigningSecret() (Warns loudly so founder configures ENCRYPTION_KEY)
   */
  private static getPrimaryKey(): Buffer {
    const dedicatedKey = process.env.ENCRYPTION_KEY || env.ENCRYPTION_KEY;
    if (dedicatedKey && dedicatedKey.trim().length > 0) {
      const trimmed = dedicatedKey.trim();
      if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
        return Buffer.from(trimmed, 'hex');
      }
      return crypto.createHash('sha256').update(trimmed).digest();
    }

    if (!encryptionKeyWarned) {
      logger.warn(
        '[SECURITY WARNING] ENCRYPTION_KEY environment variable is not configured. ' +
        'Falling back to legacy webhook signing secret. Please set a dedicated ENCRYPTION_KEY in Render to isolate encryption from webhook rotation.'
      );
      encryptionKeyWarned = true;
    }

    const explicitSecret = process.env.VOBIZ_WEBHOOK_SECRET || process.env.SIP_ENCRYPTION_KEY || env.VOBIZ_WEBHOOK_SECRET || env.SIP_ENCRYPTION_KEY;
    if (explicitSecret && explicitSecret.trim().length > 0) {
      const trimmed = explicitSecret.trim();
      if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
        return Buffer.from(trimmed, 'hex');
      }
      return crypto.createHash('sha256').update(trimmed).digest();
    }

    return Buffer.from(this.LEGACY_DEFAULT_HEX_KEY, 'hex');
  }

  /**
   * Builds the ordered list of fallback decryption keys to try if primary key fails.
   * Order:
   *   1. Primary key (sha256 of ENCRYPTION_KEY)
   *   2. env.VOBIZ_WEBHOOK_SECRET (sha256)
   *   3. env.SIP_ENCRYPTION_KEY (sha256)
   *   4. env.SIP_ENCRYPTION_KEY as direct Buffer (if 64-char hex)
   *   5. Legacy default hex key Buffer
   */
  private static getCandidateKeys(): Buffer[] {
    const keys: Buffer[] = [];
    const seenHex = new Set<string>();

    const addKey = (buf: Buffer | null | undefined) => {
      if (buf && buf.length === 32) {
        const hex = buf.toString('hex');
        if (!seenHex.has(hex)) {
          seenHex.add(hex);
          keys.push(buf);
        }
      }
    };

    // 1. Primary key
    addKey(this.getPrimaryKey());

    // 2. VOBIZ_WEBHOOK_SECRET (check both process.env and env)
    const webhookSecret = process.env.VOBIZ_WEBHOOK_SECRET || env.VOBIZ_WEBHOOK_SECRET;
    if (webhookSecret && webhookSecret.trim().length > 0) {
      addKey(crypto.createHash('sha256').update(webhookSecret.trim()).digest());
    }

    // 3. SIP_ENCRYPTION_KEY (check both process.env and env)
    const sipKey = process.env.SIP_ENCRYPTION_KEY || env.SIP_ENCRYPTION_KEY;
    if (sipKey && sipKey.trim().length > 0) {
      const trimmed = sipKey.trim();
      addKey(crypto.createHash('sha256').update(trimmed).digest());

      // 4. SIP_ENCRYPTION_KEY as direct hex buffer if 64 chars
      if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
        try {
          addKey(Buffer.from(trimmed, 'hex'));
        } catch {
          // ignore
        }
      }
    }

    // 5. Historical legacy default hex key (both direct buffer and sha256 derived)
    try {
      addKey(Buffer.from(this.LEGACY_DEFAULT_HEX_KEY, 'hex'));
      addKey(crypto.createHash('sha256').update(this.LEGACY_DEFAULT_HEX_KEY).digest());
    } catch {
      // ignore
    }

    return keys;
  }

  /**
   * Encrypts a plaintext string using the current primary key.
   * Returns a versioned string in the format: v2:iv:authTag:ciphertext
   */
  static encrypt(text: string): string {
    if (!text) return text;

    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.getPrimaryKey(), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: v2:iv(hex):authTag(hex):encrypted(hex)
    return `${this.VERSION_PREFIX}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Attempts to decrypt an encrypted payload with a specific key buffer.
   */
  private static tryDecryptWithKey(ivHex: string, authTagHex: string, cipherHex: string, key: Buffer): string | null {
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return null;
    }
  }

  /**
   * Decrypts an encrypted string and provides metadata about whether it used a legacy key format.
   * Supports both "v2:iv:authTag:ciphertext" and legacy "iv:authTag:ciphertext".
   */
  static decryptWithMetadata(encryptedText: string): { plaintext: string; isLegacy: boolean; needsMigration: boolean } {
    if (!encryptedText) {
      return { plaintext: encryptedText, isLegacy: false, needsMigration: false };
    }

    const parts = encryptedText.split(':');
    let isVersioned = false;
    let ivHex = '';
    let authTagHex = '';
    let cipherHex = '';

    if (parts.length === 4 && parts[0] === this.VERSION_PREFIX) {
      isVersioned = true;
      [, ivHex, authTagHex, cipherHex] = parts;
    } else if (parts.length === 3) {
      [ivHex, authTagHex, cipherHex] = parts;
    } else {
      throw new Error('EncryptionService: Invalid encrypted payload format.');
    }

    const candidateKeys = this.getCandidateKeys();
    for (let i = 0; i < candidateKeys.length; i++) {
      const key = candidateKeys[i];
      const plaintext = this.tryDecryptWithKey(ivHex, authTagHex, cipherHex, key);
      if (plaintext !== null) {
        const isLegacyKey = i > 0 || !isVersioned;
        return {
          plaintext,
          isLegacy: isLegacyKey,
          needsMigration: isLegacyKey,
        };
      }
    }

    throw new Error('EncryptionService: Decryption failed across all available keys (bad auth tag or key mismatch).');
  }

  /**
   * Decrypts an encrypted string.
   * Tries primary key first, then legacy sources in order.
   * Throws a descriptive error if all attempts fail.
   */
  static decrypt(encryptedText: string): string {
    const { plaintext } = this.decryptWithMetadata(encryptedText);
    return plaintext;
  }

  /**
   * Checks if a string appears to be encrypted by this service (either v2 or legacy format).
   */
  static isEncrypted(text: string): boolean {
    if (!text) return false;
    const parts = text.split(':');
    if (parts.length === 4 && parts[0] === this.VERSION_PREFIX) {
      return parts[1].length === this.IV_LENGTH * 2 && parts[2].length === this.AUTH_TAG_LENGTH * 2;
    }
    return parts.length === 3 && parts[0].length === this.IV_LENGTH * 2 && parts[1].length === this.AUTH_TAG_LENGTH * 2;
  }
}
