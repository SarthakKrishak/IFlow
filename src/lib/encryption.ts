import crypto from 'crypto';

// The encryption key should be exactly 32 bytes (256 bits).
// Fail closed in production: never encrypt team secrets with a public fallback.
// (Checked lazily at call time so imports/builds never crash on a missing key.)
const FALLBACK_KEY = 'fallback_development_key_32_bytes_!';
const configuredKey = (typeof process !== 'undefined' && process.env ? process.env.ENCRYPTION_KEY : undefined);

function requireKey(): string {
  if (!configuredKey && typeof process !== 'undefined' && process.env?.NODE_ENV === "production") {
    throw new Error("ENCRYPTION_KEY is not set. Refusing to encrypt secrets with a fallback key.");
  }
  return configuredKey || FALLBACK_KEY;
}
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * Encrypts a plain text string using AES-256-GCM.
 * @param text The plain text environment variable value.
 * @returns The encrypted string, containing salt, iv, auth tag, and ciphertext.
 */
export function encryptValue(text: string): string {
  const ENCRYPTION_KEY = requireKey();
  // To ensure the key is exactly 32 bytes, we use PBKDF2 to derive it.
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: salt:iv:authTag:encryptedText
  return [
    salt.toString('hex'),
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted
  ].join(':');
}

/**
 * Decrypts a ciphertext string using AES-256-GCM.
 * @param encryptedText The encrypted string.
 * @returns The decrypted plain text.
 */
export function decryptValue(encryptedText: string): string {
  if (!encryptedText) return '';

  const parts = encryptedText.split(':');
  if (parts.length !== 4) {
    // Return as-is if it doesn't look like our encrypted format (e.g. legacy cleartext)
    return encryptedText;
  }

  const primaryKey = requireKey();
  try {
    return decryptWithKey(parts, primaryKey);
  } catch (primaryError) {
    // Legacy rows were encrypted with the dev fallback key before a real
    // ENCRYPTION_KEY was configured (e.g. saved locally, read on Vercel).
    // Retry once with it so those values recover instead of placeholders.
    if (primaryKey !== FALLBACK_KEY) {
      try {
        return decryptWithKey(parts, FALLBACK_KEY);
      } catch {
        // fall through to the placeholder below
      }
    }
    console.error('Decryption failed:', primaryError);
    return '*** DECRYPTION_FAILED ***';
  }
}

function decryptWithKey(parts: string[], keyMaterial: string): string {
  const [saltHex, ivHex, authTagHex, encryptedHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const key = crypto.pbkdf2Sync(keyMaterial, salt, 100000, 32, 'sha512');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
