// Per-device memory: admin tokens and recently opened leagues. Everything is wrapped in
// try/catch because storage can be unavailable (private mode, blocked cookies).

const TOKENS = 'poolLeague.tokens'
const RECENT = 'poolLeague.recent'

export interface RecentLeague {
  id: string
  name: string
  visitedAt: string
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export const getToken = (leagueId: string): string | null => read<Record<string, string>>(TOKENS, {})[leagueId] ?? null

export function setToken(leagueId: string, token: string | null) {
  const all = read<Record<string, string>>(TOKENS, {})
  if (token) all[leagueId] = token
  else delete all[leagueId]
  write(TOKENS, all)
}

export const getRecent = (): RecentLeague[] => read<RecentLeague[]>(RECENT, [])

export function rememberLeague(id: string, name: string) {
  const rest = getRecent().filter((l) => l.id !== id)
  write(RECENT, [{ id, name, visitedAt: new Date().toISOString() }, ...rest].slice(0, 12))
}

export function forgetLeague(id: string) {
  write(RECENT, getRecent().filter((l) => l.id !== id))
  setToken(id, null)
}

// Which player this device belongs to — asked once when someone books or logs without being an admin.
const ME = 'poolLeague.me'

export const getMe = (leagueId: string): string | null => read<Record<string, string>>(ME, {})[leagueId] ?? null

export function setMe(leagueId: string, playerId: string) {
  write(ME, { ...read<Record<string, string>>(ME, {}), [leagueId]: playerId })
}
