import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const config = useRuntimeConfig()
  if (!config.integrationsEncryptionKey) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_INTEGRATIONS_ENCRYPTION_KEY is not configured on this server' })
  }

  const key = Buffer.from(config.integrationsEncryptionKey, 'base64')
  if (key.length !== 32) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_INTEGRATIONS_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded)' })
  }
  return key
}

/** Encrypts a secret (an OAuth token) for storage at rest. Output is a single base64 string: iv + authTag + ciphertext. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

export function decryptSecret(encoded: string): string {
  const raw = Buffer.from(encoded, 'base64')
  const iv = raw.subarray(0, IV_LENGTH)
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
