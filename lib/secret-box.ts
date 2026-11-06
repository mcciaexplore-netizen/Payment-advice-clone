import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts a secret before it is stored in the database (AES-256-GCM, key
 * derived from AUTH_SECRET). A database leak alone therefore does not expose
 * the secret. Changing AUTH_SECRET makes stored values undecryptable; callers
 * treat that as "not set" and the admin simply enters the value again.
 */
const PREFIX = "v1";

function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET environment variable is not set");
  return createHash("sha256").update(`payment-desk:secret-box:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [PREFIX, iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/** Returns null when the value is malformed, tampered with, or encrypted under a different AUTH_SECRET. */
export function decryptSecret(stored: string): string | null {
  const [prefix, iv, tag, data] = stored.split(":");
  if (prefix !== PREFIX || !iv || !tag || !data) return null;
  try {
    const authTag = Buffer.from(tag, "base64");
    if (authTag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"), { authTagLength: 16 });
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
