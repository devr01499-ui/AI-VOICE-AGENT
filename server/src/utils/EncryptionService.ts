import * as crypto from 'crypto';
import { env } from '../config/env';

/**
 * Service to handle at-rest encryption and decryption using AES-256-GCM.
 * The key is provided securely via the environment variables.
 */
export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly AUTH_TAG_LENGTH = 16;

  private static getKey(): Buffer {
    // Key must be exactly 32 bytes (256 bits).
    // The environment validates this as a 64-character hex string.
    return Buffer.from(env.SIP_ENCRYPTION_KEY, 'hex');
  }

  /**
   * Encrypts a plaintext string.
   * Returns a composite string in the format: iv:authTag:ciphertext
   *
   * @param text The plaintext string to encrypt.
   */
  static encrypt(text: string): string {
    if (!text) return text;

    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.getKey(), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv(hex):authTag(hex):encrypted(hex)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypts an encrypted string that was formatted as: iv:authTag:ciphertext
   *
   * @param encryptedText The encrypted composite string.
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;

    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      // If it doesn't match the format, it might be legacy plaintext or corrupt.
      // Do not attempt to decrypt if it isn't properly formatted.
      throw new Error('EncryptionService: Invalid encrypted payload format.');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.getKey(), iv);
    decipher.setAuthTag(authTag);

    try {
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      throw new Error('EncryptionService: Decryption failed (bad auth tag or key mismatch).');
    }
  }

  /**
   * Checks if a string appears to be encrypted by this service.
   * Useful for migration scripts.
   *
   * @param text The text to check.
   */
  static isEncrypted(text: string): boolean {
    if (!text) return false;
    const parts = text.split(':');
    return parts.length === 3 && parts[0].length === this.IV_LENGTH * 2 && parts[1].length === this.AUTH_TAG_LENGTH * 2;
  }
}
