import { describe, expect, it } from 'vitest'
import type { Match, PublicLeague } from '../../shared/types'
import { buildCalendar, unplacedMatchups, weekStart } from './schedule'

const player = (id: string, availability: string[]) => ({ id, name: id, createdAt: '', availability })

const league = (matches: Match[] = []): PublicLeague => ({
  id: 'l',
  name: 'Test',
  createdAt: '',
  updatedAt: '',
  version: 1,
  admins: [],
  players: [player('ana', ['tue-12', 'wed-12']), player('ben', ['tue-12', 'wed-12']), player('cleo', ['tue-12']), player('dee', [])],
  matches,
})

const match = (a: string, b: string, extra: Partial<Match> = {}): Match => ({
  id: `${a}-${b}`,
  playerIds: [a, b],
  scheduledAt: null,
  location: null,
  result: null,
  createdAt: '',
  ...extra,
})

// Mon 28 Sep 2026, 09:00 local
const now = new Date(2026, 8, 28, 9, 0)
const monday = weekStart(now)
const slotItems = (days: ReturnType<typeof buildCalendar>[number], dayIndex: number) => days[dayIndex].items.filter((i) => i.kind === 'slot')

describe('calendar', () => {
  it('starts weeks on Monday', () => {
    expect(weekStart(new Date(2026, 9, 1, 15))).toEqual(new Date(2026, 8, 28))
    expect(weekStart(new Date(2026, 9, 4, 15))).toEqual(new Date(2026, 8, 28)) // Sunday
  })

  it('only suggests matchups that are waiting to be booked', () => {
    // No "to book" matchups at all → nothing is suggested, even though people's times overlap.
    const [empty] = buildCalendar(league(), monday, 1, now)
    expect(slotItems(empty, 1).map((i) => i.kind === 'slot' && i.suggestion)).toEqual([null, null])

    const fixture = match('ben', 'cleo')
    const [week] = buildCalendar(league([fixture]), monday, 1, now)
    const tue = slotItems(week, 1)
    expect(tue.map((i) => i.kind === 'slot' && i.slot.id)).toEqual(['tue-12', 'tue-13'])
    expect(tue[0].kind === 'slot' && tue[0].suggestion).toBe(fixture)
    // Nobody picked tue-13, so nothing fits there.
    expect(tue[1].kind === 'slot' && tue[1].suggestion).toBeNull()
  })

  it('puts players who have not played yet first', () => {
    const played = match('ana', 'ben', { id: 'played', result: { winnerId: 'ana', method: 'standard', playedAt: '2026-09-01T12:00:00Z' } })
    const rematch = match('ana', 'ben', { id: 'rematch' })
    const cleoFirstGame = match('ana', 'cleo')
    const [week] = buildCalendar(league([played, rematch, cleoFirstGame]), monday, 1, now)
    const first = slotItems(week, 1)[0]
    expect(first.kind === 'slot' && first.suggestion?.id).toBe(cleoFirstGame.id)
  })

  it('suggests each matchup once and each player once per day', () => {
    const [week] = buildCalendar(league([match('ana', 'ben'), match('ana', 'cleo'), match('ben', 'cleo')]), monday, 1, now)
    const suggested = week.flatMap((d) => d.items).flatMap((i) => (i.kind === 'slot' && i.suggestion ? [i.suggestion.id] : []))
    expect(new Set(suggested).size).toBe(suggested.length)
  })

  it('hides slots that are booked or already past, and places games on their day', () => {
    const booked = match('ana', 'ben', { scheduledAt: new Date(2026, 8, 29, 12).toISOString() })
    const [week] = buildCalendar(league([booked]), monday, 1, new Date(2026, 8, 30, 12, 30))
    expect(week[1].items).toEqual([expect.objectContaining({ kind: 'match', match: booked })])
    // Wednesday 12:00 has passed; 13:00 is still open.
    expect(slotItems(week, 2).map((i) => i.kind === 'slot' && i.slot.id)).toEqual(['wed-13'])
  })

  it('reports to-book matchups that no slot fits, and why', () => {
    const noTimes = match('ana', 'dee') // dee hasn't picked any times
    const noOverlap = match('cleo', 'ana', { id: 'x' })
    const l = league([noTimes, noOverlap])
    const cal = buildCalendar(l, monday, 1, new Date(2026, 8, 29, 13)) // Tue 12:00 already gone; only Wed left
    // ana & cleo only overlap on Tuesday 12:00, which has passed.
    expect(unplacedMatchups(l, cal)).toEqual([
      { match: noTimes, noTimes: ['dee'] },
      { match: noOverlap, noTimes: [] },
    ])
  })
})
