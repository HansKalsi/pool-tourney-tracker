import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionResponse, LeagueResponse } from '../shared/types.js'
import { handleApi, roundRobinPairs } from './handler.js'
import { setStore, type Store, type StoredLeague } from './store.js'

class MemoryStore implements Store {
  data = new Map<string, StoredLeague>()
  async get(id: string) {
    const l = this.data.get(id)
    return l ? structuredClone(l) : null
  }
  async compareAndSet(league: StoredLeague, expected: number) {
    if ((this.data.get(league.id)?.version ?? 0) !== expected) return false
    this.data.set(league.id, structuredClone(league))
    return true
  }
  async delete(id: string) {
    this.data.delete(id)
  }
}

const post = (body: object, token: string | null = null) =>
  handleApi({ method: 'POST', query: {}, body, token }) as Promise<{ status: number; body: ActionResponse & { error?: string } }>
const get = (id: string, token: string | null = null) =>
  handleApi({ method: 'GET', query: { id }, body: undefined, token }) as Promise<{ status: number; body: LeagueResponse }>

async function setup() {
  const res = await post({ action: 'createLeague', name: 'Friday Pool', adminName: 'Hans', players: ['Ana', 'Ben', 'Cleo'] })
  expect(res.status).toBe(200)
  return { league: res.body.league!, token: res.body.token! }
}

beforeEach(() => setStore(new MemoryStore()))

describe('api', () => {
  it('creates a league and hides secrets from public reads', async () => {
    const { league, token } = await setup()
    expect(league.players.map((p) => p.name)).toEqual(['Ana', 'Ben', 'Cleo'])

    const pub = await get(league.id)
    expect(pub.body.viewer).toBeNull()
    expect(pub.body.invites).toBeUndefined()
    expect(JSON.stringify(pub.body)).not.toContain('tokenHash')

    const asAdmin = await get(league.id, token)
    expect(asAdmin.body.viewer).toMatchObject({ name: 'Hans', isOwner: true })
  })

  it('rejects changes without a valid admin token', async () => {
    const { league } = await setup()
    const res = await post({ action: 'addPlayers', leagueId: league.id, names: ['Dee'] }, 'nope')
    expect(res.status).toBe(403)
  })

  it('books a game and records a win by default', async () => {
    const { league, token } = await setup()
    const [ana, ben] = league.players
    const booked = await post(
      { action: 'createMatch', leagueId: league.id, playerIds: [ana.id, ben.id], scheduledAt: '2026-10-01T12:00:00Z', location: 'Office', result: null },
      token,
    )
    const match = booked.body.league!.matches[0]
    expect(match).toMatchObject({ scheduledAt: '2026-10-01T12:00:00.000Z', location: 'Office', result: null })

    const done = await post(
      { action: 'setResult', leagueId: league.id, matchId: match.id, result: { winnerId: ben.id, method: 'default', playedAt: '2026-10-01T12:30:00Z' } },
      token,
    )
    expect(done.body.league!.matches[0].result).toMatchObject({ winnerId: ben.id, method: 'default' })

    const bad = await post(
      { action: 'setResult', leagueId: league.id, matchId: match.id, result: { winnerId: league.players[2].id, method: 'standard', playedAt: '2026-10-01' } },
      token,
    )
    expect(bad.status).toBe(400)
  })

  it('invites a second admin with a single-use code', async () => {
    const { league, token } = await setup()
    const inv = await post({ action: 'createInvite', leagueId: league.id }, token)
    const code = inv.body.code!
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(inv.body.invites).toHaveLength(1)

    const joined = await post({ action: 'redeemInvite', leagueId: league.id, code: code.toLowerCase().replace('-', ' '), name: 'Mo' })
    expect(joined.status).toBe(200)
    expect(joined.body.viewer).toMatchObject({ name: 'Mo', isOwner: false })
    expect(joined.body.invites).toHaveLength(0)

    const again = await post({ action: 'redeemInvite', leagueId: league.id, code, name: 'Eve' })
    expect(again.status).toBe(400)

    // New admin can edit but can't remove the owner or delete the league.
    const moToken = joined.body.token!
    expect((await post({ action: 'addPlayers', leagueId: league.id, names: ['Dee'] }, moToken)).status).toBe(200)
    const owner = joined.body.league!.admins.find((a) => a.isOwner)!
    expect((await post({ action: 'removeAdmin', leagueId: league.id, adminId: owner.id }, moToken)).status).toBe(400)
    expect((await post({ action: 'deleteLeague', leagueId: league.id }, moToken)).status).toBe(403)
  })

  it('generates round-robin fixtures without duplicating existing matchups', async () => {
    const { league, token } = await setup()
    const [ana, ben] = league.players
    await post({ action: 'createMatch', leagueId: league.id, playerIds: [ana.id, ben.id], scheduledAt: null, location: null, result: null }, token)
    const res = await post({ action: 'generateFixtures', leagueId: league.id, scope: 'unplayed' }, token)
    expect(res.body.league!.matches).toHaveLength(3)
    const again = await post({ action: 'generateFixtures', leagueId: league.id, scope: 'unplayed' }, token)
    expect(again.status).toBe(400)
  })

  it('refuses to remove a player who has played', async () => {
    const { league, token } = await setup()
    const [ana, ben, cleo] = league.players
    await post(
      { action: 'createMatch', leagueId: league.id, playerIds: [ana.id, ben.id], scheduledAt: null, location: null, result: { winnerId: ana.id, method: 'standard', playedAt: '2026-09-29T17:00:00Z' } },
      token,
    )
    expect((await post({ action: 'removePlayer', leagueId: league.id, playerId: ana.id }, token)).status).toBe(400)
    expect((await post({ action: 'removePlayer', leagueId: league.id, playerId: cleo.id }, token)).status).toBe(200)
  })
})

describe('availability', () => {
  it('lets anyone set a player\'s preferred slots, but only known ones', async () => {
    const { league, token } = await setup()
    const ana = league.players[0]
    const res = await post({ action: 'setAvailability', leagueId: league.id, playerId: ana.id, slots: ['tue-13', 'wed-12', 'tue-13'] })
    expect(res.status).toBe(200)
    expect(res.body.league!.players[0].availability).toEqual(['tue-13', 'wed-12'])
    expect(res.body.viewer).toBeNull()

    // An admin doing it keeps their admin view in the response.
    const asAdmin = await post({ action: 'setAvailability', leagueId: league.id, playerId: ana.id, slots: [] }, token)
    expect(asAdmin.body.viewer).not.toBeNull()

    const bad = await post({ action: 'setAvailability', leagueId: league.id, playerId: ana.id, slots: ['fri-17'] })
    expect(bad.status).toBe(400)
  })
})

describe('activity log', () => {
  it('records who did what, newest first, and only shows it to admins', async () => {
    const { league, token } = await setup()
    const [ana, ben] = league.players
    await post({ action: 'createMatch', leagueId: league.id, playerIds: [ana.id, ben.id], scheduledAt: '2026-10-01T12:00:00Z', location: null, result: null }, token)
    const matchId = (await get(league.id)).body.league.matches[0].id
    await post({ action: 'setResult', leagueId: league.id, matchId, result: { winnerId: ben.id, method: 'default', playedAt: '2026-10-01T12:30:00Z' } }, token)
    const inv = await post({ action: 'createInvite', leagueId: league.id }, token)
    await post({ action: 'redeemInvite', leagueId: league.id, code: inv.body.code, name: 'Mo' })

    const pub = await get(league.id)
    expect(pub.body.activity).toBeUndefined()
    expect(JSON.stringify(pub.body)).not.toContain('entered a result')

    const log = (await get(league.id, token)).body.activity!
    expect(log.map((e) => [e.actor, e.text])).toEqual([
      ['Mo', 'joined as an admin (invited by Hans)'],
      ['Hans', 'created an admin invite'],
      ['Hans', 'entered a result: Ben won vs Ana (by default)'],
      ['Hans', 'booked Ana v Ben'],
      ['Hans', 'created the league with 3 players'],
    ])
    expect(log[2]).toMatchObject({ category: 'games', when: '2026-10-01T12:30:00.000Z' })
    expect(log[0].category).toBe('admin')
  })

  it('logs public play-time changes as anonymous and merges repeated taps', async () => {
    const { league, token } = await setup()
    const ana = league.players[0]
    for (const slots of [['tue-12'], ['tue-12', 'wed-12'], ['wed-12']]) {
      await post({ action: 'setAvailability', leagueId: league.id, playerId: ana.id, slots })
    }
    const log = (await get(league.id, token)).body.activity!
    expect(log.filter((e) => e.action === 'setAvailability')).toEqual([
      expect.objectContaining({ actor: null, text: "updated Ana's play times", category: 'players' }),
    ])
  })
})

describe('roundRobinPairs', () => {
  it('pairs everyone exactly once', () => {
    const pairs = roundRobinPairs(['a', 'b', 'c', 'd', 'e'])
    expect(pairs).toHaveLength(10)
    expect(new Set(pairs.map((p) => [...p].sort().join())).size).toBe(10)
  })
})
