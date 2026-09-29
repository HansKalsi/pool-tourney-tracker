import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

export const newToken = () => randomBytes(24).toString('base64url')

export const hash = (value: string) => createHash('sha256').update(value).digest('hex')

export function hashMatches(value: string, expectedHash: string) {
  const a = Buffer.from(hash(value), 'hex')
  const b = Buffer.from(expectedHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
// No 0/O/1/I/L — invite codes get read out loud and typed on phones.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function randomString(alphabet: string, length: number) {
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)]
  return out
}

export const newId = (length = 10) => randomString(ID_ALPHABET, length)

/** e.g. "K7QM-2XPA" */
export const newInviteCode = () => `${randomString(CODE_ALPHABET, 4)}-${randomString(CODE_ALPHABET, 4)}`

/** Accepts codes typed in lowercase, with spaces, or without the dash. */
export function normalizeInviteCode(code: string) {
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean
}
