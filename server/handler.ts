import type {
  Action,
  ActionName,
  ActivityCategory,
  ActivityEntry,
  ActionResponse,
  LeagueResponse,
  Match,
  MatchResult,
  PublicLeague,
  ResultMethod,
  Viewer,
} from '../shared/types.js'
import { SLOT_IDS } from '../shared/slots.js'
import { hash, hashMatches, newId, newInviteCode, newToken, normalizeInviteCode } from './security.js'
import { getStore, StorageNotConfiguredError, type StoredAdmin, type StoredLeague } from './store.js'

export interface ApiRequest {
  method: string
  query: Record<string, string | undefined>
  body: unknown
  token: string | null
}

export interface ApiResult {
  status: number
  body: unknown
}

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const LIMITS = {
  leagueName: 60,
  personName: 40,
  location: 80,
  players: 64,
  matches: 5000,
  admins: 20,
  invites: 20,
}
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ACTIVITY_LIMIT = 300
/** Repeated play-time taps for the same player by the same person merge into one log line. */
const ACTIVITY_MERGE_MS = 10 * 60 * 1000
const CAS_RETRIES = 4

// ---------- validation ----------

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `${field} is required.`)
  const v = value.trim().replace(/\s+/g, ' ')
  if (v.length > max) throw new HttpError(400, `${field} must be ${max} characters or fewer.`)
  return v
}

function optionalText(value: unknown, field: string, max: number): string | null {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null
  return text(value, field, max)
}

function isoDate(value: unknown, field: string): string {
  const d = typeof value === 'string' ? new Date(value) : null
  if (!d || Number.isNaN(d.getTime())) throw new HttpError(400, `${field} must be a valid date.`)
  return d.toISOString()
}

function optionalIsoDate(value: unknown, field: string): string | null {
  return value === null || value === undefined || value === '' ? null : isoDate(value, field)
}

function findPlayer(league: StoredLeague, id: unknown) {
  const p = league.players.find((pl) => pl.id === id)
  if (!p) throw new HttpError(400, 'That player is not in this league.')
  return p
}

function findMatch(league: StoredLeague, id: unknown) {
  const m = league.matches.find((mt) => mt.id === id)
  if (!m) throw new HttpError(404, 'That game no longer exists.')
  return m
}

function assertUniqueName(league: StoredLeague, name: string, exceptId?: string) {
  const taken = league.players.some((p) => p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase())
  if (taken) throw new HttpError(400, `There's already a player called "${name}".`)
}

function pairOf(league: StoredLeague, value: unknown): [string, string] {
  if (!Array.isArray(value) || value.length !== 2) throw new HttpError(400, 'Pick two players.')
  const [a, b] = value.map((id) => findPlayer(league, id).id)
  if (a === b) throw new HttpError(400, 'A player cannot play themselves.')
  return [a, b]
}

function resultFor(pair: [string, string], value: unknown): MatchResult | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'object') throw new HttpError(400, 'Invalid result.')
  const r = value as Record<string, unknown>
  if (typeof r.winnerId !== 'string' || !pair.includes(r.winnerId)) {
    throw new HttpError(400, 'The winner must be one of the two players.')
  }
  const method: ResultMethod = r.method === 'default' ? 'default' : 'standard'
  return { winnerId: r.winnerId, method, playedAt: isoDate(r.playedAt, 'Date played') }
}

function nameList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v) => typeof v === 'string' && v.trim()).map((v) => text(v, 'Player name', LIMITS.personName))
}

// ---------- helpers ----------

const now = () => new Date().toISOString()

function toPublic(league: StoredLeague): PublicLeague {
  const { invites: _invites, activity: _activity, admins, ...rest } = league
  return { ...rest, admins: admins.map(({ tokenHash: _t, ...a }) => a) }
}

function findAdmin(league: StoredLeague, token: string | null): StoredAdmin | null {
  if (!token) return null
  return league.admins.find((a) => hashMatches(token, a.tokenHash)) ?? null
}

function toResponse(league: StoredLeague, admin: StoredAdmin | null): LeagueResponse {
  const viewer: Viewer | null = admin ? { adminId: admin.id, name: admin.name, isOwner: admin.isOwner } : null
  const res: LeagueResponse = { league: toPublic(league), viewer }
  if (admin) {
    const t = Date.now()
    res.invites = league.invites
      .filter((i) => Date.parse(i.expiresAt) > t)
      .map(({ codeHash: _c, ...i }) => i)
    res.activity = [...(league.activity ?? [])].reverse()
  }
  return res
}

/** Circle-method round robin so generated fixtures come out in sensible "rounds". */
export function roundRobinPairs(ids: string[]): [string, string][] {
  const list: (string | null)[] = [...ids]
  if (list.length < 2) return []
  if (list.length % 2) list.push(null)
  const n = list.length
  const pairs: [string, string][] = []
  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const a = list[i]
      const b = list[n - 1 - i]
      if (a && b) pairs.push(round % 2 ? [b, a] : [a, b])
    }
    list.splice(1, 0, list.pop()!)
  }
  return pairs
}

const pairKey = (a: string, b: string) => [a, b].sort().join(':')

// ---------- activity log ----------

const CATEGORY: Record<ActionName, ActivityCategory> = {
  createLeague: 'admin',
  redeemInvite: 'admin',
  renameLeague: 'admin',
  deleteLeague: 'admin',
  createInvite: 'admin',
  revokeInvite: 'admin',
  removeAdmin: 'admin',
  addPlayers: 'players',
  renamePlayer: 'players',
  removePlayer: 'players',
  setAvailability: 'players',
  createMatch: 'games',
  updateMatch: 'games',
  setResult: 'games',
  deleteMatch: 'games',
  generateFixtures: 'games',
}

type Log = (text: string, opts?: { when?: string | null; actor?: string | null }) => void

function addActivity(league: StoredLeague, entry: Omit<ActivityEntry, 'id' | 'at' | 'category'>) {
  const log = (league.activity ??= [])
  const at = now()
  const last = log.at(-1)
  if (
    entry.action === 'setAvailability' &&
    last?.action === 'setAvailability' &&
    last.actor === entry.actor &&
    last.text === entry.text &&
    Date.parse(at) - Date.parse(last.at) < ACTIVITY_MERGE_MS
  ) {
    last.at = at
    return
  }
  const { when, ...rest } = entry
  log.push({ id: newId(), at, category: CATEGORY[entry.action], ...rest, ...(when ? { when } : {}) })
  if (log.length > ACTIVITY_LIMIT) league.activity = log.slice(-ACTIVITY_LIMIT)
}

const nameOf = (league: StoredLeague, id: string) => league.players.find((p) => p.id === id)?.name ?? 'a removed player'
const vs = (league: StoredLeague, [a, b]: [string, string]) => `${nameOf(league, a)} v ${nameOf(league, b)}`
function resultText(league: StoredLeague, match: Match) {
  const r = match.result!
  const loser = match.playerIds.find((id) => id !== r.winnerId)!
  return `${nameOf(league, r.winnerId)} won vs ${nameOf(league, loser)}${r.method === 'default' ? ' (by default)' : ''}`
}

// ---------- mutations ----------

type Auth = 'none' | 'admin' | 'owner'
type Mutation = (league: StoredLeague, admin: StoredAdmin | null, log: Log) => Omit<ActionResponse, keyof LeagueResponse> | void

/**
 * Read → apply → compare-and-set, retrying if someone else saved in between.
 * `mutation` works on a fresh copy each attempt, so it must be free of outside side effects.
 */
async function mutate(action: { action: ActionName; leagueId?: unknown }, token: string | null, auth: Auth, mutation: Mutation): Promise<ActionResponse> {
  const { leagueId } = action
  if (typeof leagueId !== 'string') throw new HttpError(400, 'Missing league id.')
  const store = getStore()
  for (let attempt = 0; attempt < CAS_RETRIES; attempt++) {
    const current = await store.get(leagueId)
    if (!current) throw new HttpError(404, 'League not found.')
    const admin = findAdmin(current, token)
    if (auth !== 'none' && !admin) throw new HttpError(403, 'Only league admins can make changes.')
    if (auth === 'owner' && !admin?.isOwner) throw new HttpError(403, 'Only the league creator can do that.')

    const draft: StoredLeague = structuredClone(current)
    draft.invites = draft.invites.filter((i) => Date.parse(i.expiresAt) > Date.now())
    const log: Log = (text, opts) =>
      addActivity(draft, { actor: opts?.actor !== undefined ? opts.actor : (admin?.name ?? null), action: action.action, text, when: opts?.when ?? undefined })
    const extra = mutation(draft, admin, log) ?? {}
    draft.version = current.version + 1
    draft.updatedAt = now()

    if (await store.compareAndSet(draft, current.version)) {
      // The caller may have been added (redeemInvite) or removed (removeAdmin) by this mutation.
      const viewer = extra.token ? findAdmin(draft, extra.token) : admin && draft.admins.find((a) => a.id === admin.id)
      return { ...toResponse(draft, viewer ?? null), ...extra }
    }
  }
  throw new HttpError(409, 'Someone else just saved a change at the same time — please try again.')
}

async function createLeague(body: Record<string, unknown>): Promise<ActionResponse> {
  const name = text(body.name, 'League name', LIMITS.leagueName)
  const adminName = text(body.adminName, 'Your name', LIMITS.personName)
  const names = nameList(body.players)
  if (names.length > LIMITS.players) throw new HttpError(400, `A league can have at most ${LIMITS.players} players.`)

  const created = now()
  const token = newToken()
  const league: StoredLeague = {
    id: newId(),
    name,
    createdAt: created,
    updatedAt: created,
    version: 1,
    players: [],
    matches: [],
    admins: [{ id: newId(), name: adminName, isOwner: true, createdAt: created, tokenHash: hash(token) }],
    invites: [],
  }
  for (const n of names) {
    assertUniqueName(league, n)
    league.players.push({ id: newId(), name: n, createdAt: created })
  }
  addActivity(league, {
    actor: adminName,
    action: 'createLeague',
    text: `created the league${names.length ? ` with ${names.length} players` : ''}`,
  })
  if (!(await getStore().compareAndSet(league, 0))) throw new HttpError(409, 'Please try again.')
  return { ...toResponse(league, league.admins[0]), token }
}

async function runAction(body: Record<string, unknown>, token: string | null): Promise<ActionResponse> {
  const a = body as Action
  switch (a.action) {
    case 'createLeague':
      return createLeague(body)

    case 'redeemInvite':
      return mutate(a, null, 'none', (league, _admin, log) => {
        const code = normalizeInviteCode(String(a.code ?? ''))
        const invite = league.invites.find((i) => hashMatches(code, i.codeHash))
        if (!invite) throw new HttpError(400, 'That invite code is invalid or has expired.')
        if (league.admins.length >= LIMITS.admins) throw new HttpError(400, 'This league has the maximum number of admins.')
        const newAdminToken = newToken()
        const name = text(a.name, 'Your name', LIMITS.personName)
        league.invites = league.invites.filter((i) => i !== invite)
        league.admins.push({ id: newId(), name, isOwner: false, createdAt: now(), tokenHash: hash(newAdminToken) })
        log(`joined as an admin (invited by ${invite.createdBy})`, { actor: name })
        return { token: newAdminToken }
      })

    case 'renameLeague':
      return mutate(a, token, 'admin', (league, _admin, log) => {
        const before = league.name
        league.name = text(a.name, 'League name', LIMITS.leagueName)
        log(`renamed the league from "${before}" to "${league.name}"`)
      })

    case 'deleteLeague': {
      const league = typeof a.leagueId === 'string' ? await getStore().get(a.leagueId) : null
      if (!league) throw new HttpError(404, 'League not found.')
      if (!findAdmin(league, token)?.isOwner) throw new HttpError(403, 'Only the league creator can delete it.')
      await getStore().delete(league.id)
      return { deleted: true }
    }

    case 'addPlayers':
      return mutate(a, token, 'admin', (league, _admin, log) => {
        const names = nameList(a.names)
        if (!names.length) throw new HttpError(400, 'Enter at least one name.')
        if (league.players.length + names.length > LIMITS.players) {
          throw new HttpError(400, `A league can have at most ${LIMITS.players} players.`)
        }
        for (const n of names) {
          assertUniqueName(league, n)
          league.players.push({ id: newId(), name: n, createdAt: now() })
        }
        log(`added ${names.length === 1 ? 'player' : 'players'} ${names.join(', ')}`)
      })

    case 'renamePlayer':
      return mutate(a, token, 'admin', (league, _admin, log) => {
        const player = findPlayer(league, a.playerId)
        const name = text(a.name, 'Player name', LIMITS.personName)
        assertUniqueName(league, name, player.id)
        log(`renamed ${player.name} to ${name}`)
        player.name = name
      })

    case 'removePlayer':
      return mutate(a, token, 'admin', (league, _admin, log) => {
        const player = findPlayer(league, a.playerId)
        const involved = league.matches.filter((m) => m.playerIds.includes(player.id))
        if (involved.some((m) => m.result)) {
          throw new HttpError(400, `${player.name} has played games, so they can't be removed (it would change everyone else's stats).`)
        }
        league.matches = league.matches.filter((m) => !involved.includes(m))
        league.players = league.players.filter((p) => p !== player)
        log(`removed player ${player.name}`)
      })

    case 'setAvailability':
      // Deliberately public: it's only a preference, and players aren't admins.
      return mutate(a, token, 'none', (league, _admin, log) => {
        const player = findPlayer(league, a.playerId)
        if (!Array.isArray(a.slots) || a.slots.some((id) => !SLOT_IDS.has(id))) throw new HttpError(400, 'Unknown time slot.')
        player.availability = [...new Set(a.slots)]
        log(`updated ${player.name}'s play times`)
      })

    case 'createMatch':
      return mutate(a, token, 'admin', (league, _admin, log) => {
        if (league.matches.length >= LIMITS.matches) throw new HttpError(400, 'This league has hit its game limit.')
        const playerIds = pairOf(league, a.playerIds)
        const match: Match = {
          id: newId(),
          playerIds,
          scheduledAt: optionalIsoDate(a.scheduledAt, 'Date'),
          location: optionalText(a.location, 'Location', LIMITS.location),
          result: resultFor(playerIds, a.result),
          createdAt: now(),
        }
        league.matches.push(match)
        if (match.result) log(`logged a result: ${resultText(league, match)}`, { when: match.result.playedAt })
        else if (match.scheduledAt) log(`booked ${vs(league, playerIds)}`, { when: match.scheduledAt })
        else log(`added a matchup: ${vs(league, playerIds)}`)
      })

    case 'updateMatch':
      return mutate(a, token, 'admin', (league, _admin, log) => {
        const match = findMatch(league, a.matchId)
        const before = match.scheduledAt
        match.scheduledAt = optionalIsoDate(a.scheduledAt, 'Date')
        match.location = optionalText(a.location, 'Location', LIMITS.location)
        const game = vs(league, match.playerIds)
        if (!match.scheduledAt) log(`cleared the booking for ${game}`)
        else if (before && before !== match.scheduledAt) log(`moved ${game}`, { when: match.scheduledAt })
        else if (before) log(`updated the booking for ${game}`, { when: match.scheduledAt })
        else log(`booked ${game}`, { when: match.scheduledAt })
      })

    case 'setResult':
      return mutate(a, token, 'admin', (league, _admin, log) => {
        const match = findMatch(league, a.matchId)
        const had = !!match.result
        match.result = resultFor(match.playerIds, a.result)
        if (!match.result) log(`cleared the result of ${vs(league, match.playerIds)}`)
        else log(`${had ? 'changed a result' : 'entered a result'}: ${resultText(league, match)}`, { when: match.result.playedAt })
      })

    case 'deleteMatch':
      return mutate(a, token, 'admin', (league, _admin, log) => {
        const match = findMatch(league, a.matchId)
        league.matches = league.matches.filter((m) => m !== match)
        log(match.result ? `deleted a played game: ${resultText(league, match)}` : `deleted ${vs(league, match.playerIds)}`)
      })

    case 'generateFixtures':
      return mutate(a, token, 'admin', (league, _admin, log) => {
        const relevant = a.scope === 'all' ? league.matches.filter((m) => !m.result) : league.matches
        const existing = new Set(relevant.map((m) => pairKey(...m.playerIds)))
        const created = now()
        const fresh: Match[] = roundRobinPairs(league.players.map((p) => p.id))
          .filter(([x, y]) => !existing.has(pairKey(x, y)))
          .map((playerIds) => ({ id: newId(), playerIds, scheduledAt: null, location: null, result: null, createdAt: created }))
        if (!fresh.length) throw new HttpError(400, 'Every matchup already has a game lined up.')
        if (league.matches.length + fresh.length > LIMITS.matches) throw new HttpError(400, 'Too many games.')
        league.matches.push(...fresh)
        log(`created ${fresh.length} new ${fresh.length === 1 ? 'matchup' : 'matchups'}${a.scope === 'all' ? ' (new round)' : ''}`)
      })

    case 'createInvite':
      return mutate(a, token, 'admin', (league, admin, log) => {
        if (league.invites.length >= LIMITS.invites) throw new HttpError(400, 'Too many open invites — revoke some first.')
        const code = newInviteCode()
        const created = new Date()
        league.invites.push({
          id: newId(),
          codeHash: hash(code),
          createdBy: admin!.name,
          createdAt: created.toISOString(),
          expiresAt: new Date(created.getTime() + INVITE_TTL_MS).toISOString(),
        })
        log('created an admin invite')
        return { code }
      })

    case 'revokeInvite':
      return mutate(a, token, 'admin', (league, _admin, log) => {
        const invite = league.invites.find((i) => i.id === a.inviteId)
        league.invites = league.invites.filter((i) => i.id !== a.inviteId)
        if (invite) log(`revoked an admin invite (created by ${invite.createdBy})`)
      })

    case 'removeAdmin':
      return mutate(a, token, 'admin', (league, admin, log) => {
        const target = league.admins.find((x) => x.id === a.adminId)
        if (!target) throw new HttpError(404, 'That admin no longer exists.')
        if (target.isOwner) throw new HttpError(400, "The league creator can't be removed.")
        if (!admin!.isOwner && target.id !== admin!.id) {
          throw new HttpError(403, 'Only the league creator can remove other admins.')
        }
        league.admins = league.admins.filter((x) => x !== target)
        log(target.id === admin!.id ? 'stepped down as an admin' : `removed ${target.name} as an admin`)
      })

    default:
      throw new HttpError(400, 'Unknown action.')
  }
}

export async function handleApi(req: ApiRequest): Promise<ApiResult> {
  try {
    if (req.method === 'GET') {
      const id = req.query.id
      if (!id) throw new HttpError(400, 'Missing league id.')
      const league = await getStore().get(id)
      if (!league) throw new HttpError(404, 'League not found.')
      return { status: 200, body: toResponse(league, findAdmin(league, req.token)) }
    }
    if (req.method === 'POST') {
      if (!req.body || typeof req.body !== 'object') throw new HttpError(400, 'Expected a JSON body.')
      return { status: 200, body: await runAction(req.body as Record<string, unknown>, req.token) }
    }
    return { status: 405, body: { error: 'Method not allowed.' } }
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, body: { error: err.message } }
    if (err instanceof StorageNotConfiguredError) return { status: 503, body: { error: err.message } }
    console.error(err)
    return { status: 500, body: { error: 'Something went wrong on the server.' } }
  }
}
