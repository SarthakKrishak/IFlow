import crypto from 'crypto';

// The encryption key should be exactly 32 bytes (256 bits).
// We use a fallback key for development if not provided, but in production this MUST be set.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'fallback_development_key_32_bytes_!';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * Encrypts a plain text string using AES-256-GCM.
 * @param text The plain text environment variable value.
 * @returns The encrypted string, containing salt, iv, auth tag, and ciphertext.
 */
export function encryptValue(text: string): string {
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
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 4) {
      // Return as-is if it doesn't look like our encrypted format (e.g. legacy cleartext)
      return encryptedText;
    }

    const [saltHex, ivHex, authTagHex, encryptedHex] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // We expect encryptedHex to be hex, so we don't need to Buffer.from it, createDecipheriv's update can take hex input
    // wait, actually we can just pass the hex string to update

    const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return '*** DECRYPTION_FAILED ***';
  }
}
