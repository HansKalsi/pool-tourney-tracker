import { describe, expect, it } from 'vitest'
import type { Match, PublicLeague, ResultMethod } from '../../shared/types'
import { computeRatings, computeStats, headToHead, highlights, podium, pointsCaptured, pointsInPlay, STARTING_RATING, stillToPlay, timeline } from './stats'

let n = 0
const game = (a: string, b: string, winner: string, method: ResultMethod = 'standard'): Match => ({
  id: `m${++n}`,
  playerIds: [a, b],
  scheduledAt: null,
  location: null,
  createdAt: '2026-01-01T00:00:00Z',
  result: { winnerId: winner, method, playedAt: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString() },
})

const league = (matches: Match[]): PublicLeague => ({
  id: 'l',
  name: 'Test',
  createdAt: '',
  updatedAt: '',
  version: 1,
  admins: [],
  players: ['ana', 'ben', 'cleo', 'dee', 'eli'].map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1), createdAt: '' })),
  matches,
})

describe('skill rating', () => {
  it('captures 25 points for an even win', () => {
    expect(pointsCaptured(1000, 1000)).toBe(25)
  })

  it('treats a win by default as a normal win (official rules)', () => {
    const normal = computeRatings(league([game('ana', 'ben', 'ana', 'standard')]))
    const byDefault = computeRatings(league([game('ana', 'ben', 'ana', 'default')]))
    expect(byDefault.current).toEqual(normal.current)
  })

  it('rewards upsets and protects newcomers who lose to stronger players', () => {
    expect(pointsCaptured(900, 1100)).toBe(38) // underdog wins big
    expect(pointsCaptured(1100, 900)).toBe(12) // favourite gains little
  })

  it('shows the points in play, favouring the underdog', () => {
    const r = computeRatings(league([]))
    r.current.set('ana', 950)
    r.current.set('ben', 1050)
    // 50 points wagered in total, split by how likely each player is to win.
    expect(pointsInPlay(r, 'ana', 'ben')).toEqual({ ana: 32, ben: 18 })
  })

  it('is zero-sum: points are captured, never created', () => {
    const r = computeRatings(league([game('ana', 'ben', 'ana'), game('ben', 'cleo', 'cleo', 'default'), game('ana', 'cleo', 'cleo')]))
    const total = [...r.current.values()].reduce((a, b) => a + b, 0)
    expect(total).toBe(STARTING_RATING * 5)
    expect(r.current.get('dee')).toBe(STARTING_RATING)
  })
})

describe('stats', () => {
  const l = league([
    game('ana', 'ben', 'ana'),
    game('ana', 'cleo', 'ana', 'default'),
    game('ben', 'cleo', 'ben'),
    game('ana', 'ben', 'ben'),
    game('ana', 'ben', 'ana'),
    { ...game('ana', 'dee', 'ana'), result: null }, // booked, not played
  ])
  const stats = computeStats(l)
  const by = (id: string) => stats.find((s) => s.player.id === id)!

  it('counts wins, default wins and streaks', () => {
    expect(by('ana')).toMatchObject({ played: 4, wins: 3, winsByDefault: 1, losses: 1, bestStreak: 2, currentStreak: 1 })
    expect(by('ben')).toMatchObject({ played: 4, wins: 2, currentStreak: 0 })
    expect(by('dee').played).toBe(0)
  })

  it('builds a podium by rating, only from players who have played', () => {
    const steps = podium(stats)
    expect(steps.map((s) => s.entries.map((e) => e.player.id))).toEqual([['ana'], ['ben'], ['cleo']])
    expect(steps.flatMap((s) => s.entries).some((e) => e.player.id === 'dee')).toBe(false)
  })

  it('lets tied players share a step', () => {
    const tied = podium(computeStats(league([game('ana', 'ben', 'ana'), game('cleo', 'dee', 'cleo')])))
    expect(tied[0].entries.map((e) => e.player.id)).toEqual(['ana', 'cleo'])
    expect(tied[1].entries.map((e) => e.player.id)).toEqual(['ben', 'dee'])
    expect(tied).toHaveLength(2)
  })

  it('tracks wins and rating over time', () => {
    expect(timeline(l, 'ana').map((t) => [t.outcome, t.cumulativeWins, t.change])).toEqual([
      ['win', 1, 25], // 1000 vs 1000
      ['default-win', 2, 23], // full points; Ana was already the slight favourite
      ['loss', 2, -28], // lost to a lower-rated Ben
      ['win', 3, 26],
    ])
    expect(timeline(l, 'ana').at(-1)!.rating).toBe(by('ana').rating)
  })

  it('summarises head-to-head records', () => {
    const h = headToHead(l, 'ana')
    expect(h[0]).toMatchObject({ opponent: { id: 'ben' }, played: 3, wins: 2, losses: 1 })
    expect(h[1]).toMatchObject({ opponent: { id: 'cleo' }, played: 1, wins: 1 })
  })

  it('only produces upbeat highlights', () => {
    const titles = highlights(l, stats).map((h) => h.title)
    expect(titles).toContain('Top rivalry')
    expect(titles.join()).not.toMatch(/worst|loss|last/i)
  })
})

describe('stillToPlay', () => {
  it('lists who each player has not played yet, most outstanding first', () => {
    const booked = { ...game('ben', 'cleo', 'ben'), result: null, scheduledAt: '2026-10-01T12:00:00Z' }
    const l = league([game('ana', 'ben', 'ana'), game('ana', 'cleo', 'cleo'), booked])
    const { rows, playedPairs, totalPairs } = stillToPlay(l)
    expect(playedPairs).toBe(2)
    expect(totalPairs).toBe(10)
    const byId = Object.fromEntries(rows.map((r) => [r.player.id, r.remaining.map((x) => x.opponent.id)]))
    expect(byId.ana).toEqual(['dee', 'eli'])
    expect(byId.ben).toEqual(['cleo', 'dee', 'eli'])
    expect(rows.find((r) => r.player.id === 'ben')!.remaining[0].booked).toBe(booked)
    // Players who've played nobody come first.
    expect(rows[0].player.id).toBe('dee')
  })
})
