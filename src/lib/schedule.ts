import dayjs from 'dayjs'
import { PLAY_SLOTS, type PlaySlot } from '../../shared/slots'
import type { Match, PublicLeague } from '../../shared/types'

export type CalendarItem =
  | { kind: 'match'; at: Date; match: Match }
  /** An office slot with no game booked yet, plus the "to book" matchup that fits it (if any). */
  | { kind: 'slot'; at: Date; slot: PlaySlot; suggestion: Match | null }

export interface CalendarDay {
  date: Date
  isToday: boolean
  isPast: boolean
  items: CalendarItem[]
}

/** Monday 00:00 of the week containing `date`. */
export function weekStart(date: Date) {
  const d = dayjs(date).startOf('day')
  return d.subtract((d.day() + 6) % 7, 'day').toDate()
}

const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`)

/**
 * Fills open office slots with matchups from the league's "to book" list — the whole point is
 * that everyone plays everyone. A matchup only fits a slot if both players said it suits them.
 * Priority: anyone who hasn't played yet, then pairs who've never met, then players who've
 * played least; ties go to the matchup that's been waiting longest. Each matchup is suggested
 * once per view and each player at most once per day.
 */
export function suggestPairings(league: PublicLeague, slots: { key: string; slot: PlaySlot; at: Date }[]) {
  const met = new Map<string, number>()
  const playedBy = new Map<string, number>()
  for (const m of league.matches) {
    if (!m.result) continue
    const k = pairKey(...m.playerIds)
    met.set(k, (met.get(k) ?? 0) + 1)
    for (const id of m.playerIds) playedBy.set(id, (playedBy.get(id) ?? 0) + 1)
  }
  const availability = new Map(league.players.map((p) => [p.id, p.availability ?? []]))
  const toBook = league.matches.filter((m) => !m.result && !m.scheduledAt)

  const score = (m: Match) => {
    const [a, b] = m.playerIds.map((id) => playedBy.get(id) ?? 0)
    return (a === 0 || b === 0 ? 10_000 : 0) + (met.has(pairKey(...m.playerIds)) ? 0 : 1_000) - (a + b)
  }

  const used = new Set<string>()
  const busyOnDay = new Map<string, Set<string>>()
  const out = new Map<string, Match | null>()

  for (const { key, slot, at } of [...slots].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const day = dayjs(at).format('YYYY-MM-DD')
    const busy = busyOnDay.get(day) ?? new Set<string>()
    let best: Match | null = null
    for (const m of toBook) {
      if (used.has(m.id) || m.playerIds.some((id) => busy.has(id) || !availability.get(id)?.includes(slot.id))) continue
      // Strictly greater keeps the earliest-created matchup on ties.
      if (!best || score(m) > score(best)) best = m
    }
    out.set(key, best)
    if (best) {
      used.add(best.id)
      busy.add(best.playerIds[0]).add(best.playerIds[1])
      busyOnDay.set(day, busy)
    }
  }
  return out
}

export interface Unplaced {
  match: Match
  /** Players who haven't ticked any play times (empty = their times just don't overlap). */
  noTimes: string[]
}

/** "To book" matchups that didn't get a slot in the given calendar, and why. */
export function unplacedMatchups(league: PublicLeague, calendar: CalendarDay[][]): Unplaced[] {
  const placed = new Set(calendar.flat(2).flatMap((d) => d.items).flatMap((i) => (i.kind === 'slot' && i.suggestion ? [i.suggestion.id] : [])))
  const times = new Map(league.players.map((p) => [p.id, p.availability ?? []]))
  return league.matches
    .filter((m) => !m.result && !m.scheduledAt && !placed.has(m.id))
    .map((match) => ({ match, noTimes: match.playerIds.filter((id) => !times.get(id)?.length) }))
}

/** `weeks` weeks of days from `start` (a Monday), with games and open office slots on each. */
export function buildCalendar(league: PublicLeague, start: Date, weeks: number, now = new Date()): CalendarDay[][] {
  const first = dayjs(start).startOf('day')
  const days = Array.from({ length: weeks * 7 }, (_, i) => first.add(i, 'day'))
  const last = days.at(-1)!.endOf('day')

  const matchItems: CalendarItem[] = []
  const bookedTimes = new Set<number>()
  for (const m of league.matches) {
    const iso = m.result?.playedAt ?? m.scheduledAt
    if (!iso) continue
    const at = new Date(iso)
    if (!m.result) bookedTimes.add(at.getTime())
    if (at >= first.toDate() && at <= last.toDate()) matchItems.push({ kind: 'match', at, match: m })
  }

  // Future office slots in range that nobody has booked yet.
  const openSlots = days.flatMap((d) =>
    PLAY_SLOTS.filter((s) => s.day === d.day())
      .map((slot) => ({ slot, at: d.hour(slot.startHour).toDate(), key: `${d.format('YYYY-MM-DD')}:${slot.id}` }))
      .filter(({ at }) => at > now && !bookedTimes.has(at.getTime())),
  )
  const suggestions = suggestPairings(league, openSlots)

  const today = dayjs(now).startOf('day')
  const byDay: CalendarDay[] = days.map((d) => {
    const items: CalendarItem[] = [
      ...matchItems.filter((it) => dayjs(it.at).isSame(d, 'day')),
      ...openSlots
        .filter((s) => dayjs(s.at).isSame(d, 'day'))
        .map((s): CalendarItem => ({ kind: 'slot', at: s.at, slot: s.slot, suggestion: suggestions.get(s.key) ?? null })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime())
    return { date: d.toDate(), isToday: d.isSame(today, 'day'), isPast: d.isBefore(today, 'day'), items }
  })

  return Array.from({ length: weeks }, (_, w) => byDay.slice(w * 7, w * 7 + 7))
}
