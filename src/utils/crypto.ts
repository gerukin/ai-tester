import crypto from 'node:crypto'

/**
 * Generate a SHA-256 hash for the input string
 *
 * @param inputString The string to hash
 * @returns The hash digest in 'hex' format
 */
export const generateHash = (inputString: string) => crypto.createHash('sha256').update(inputString).digest('hex')
