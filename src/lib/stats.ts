import type { Match, Player, PublicLeague } from '../../shared/types'

export type Outcome = 'win' | 'default-win' | 'loss'

export type PlayedMatch = Match & { result: NonNullable<Match['result']> }

// ---------- skill rating ----------
// Elo-style and zero-sum: the winner captures points straight from the loser. How many depends
// on how surprising the result was — beating a stronger player captures more, and losing to a
// stronger player costs little, which keeps things gentle for newcomers.

export const STARTING_RATING = 1000
/**
 * Points wagered per game: the two possible payouts always add up to K (e.g. underdog +32 / favourite +18).
 * Between equally rated players a normal win captures K / 2.
 */
export const K = 50
/**
 * Points the winner captures from the loser. Per official 8-ball rules, potting the black early is
 * simply a loss, so a win by default pays exactly the same as any other win.
 */
export function pointsCaptured(winnerRating: number, loserRating: number) {
  const expected = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400))
  return Math.max(1, Math.round(K * (1 - expected)))
}

/** Points each player would capture by winning. */
export function pointsInPlay(ratings: Ratings, a: string, b: string) {
  const ra = ratings.current.get(a) ?? STARTING_RATING
  const rb = ratings.current.get(b) ?? STARTING_RATING
  return { [a]: pointsCaptured(ra, rb), [b]: pointsCaptured(rb, ra) } as Record<string, number>
}

export interface Ratings {
  /** Current rating per player id (players with no games are at STARTING_RATING). */
  current: Map<string, number>
  /** Points the winner captured in each played match. */
  captured: Map<string, number>
  /** Each player's rating after each of their games, oldest first. */
  history: Map<string, number[]>
}

export function computeRatings(league: PublicLeague): Ratings {
  const current = new Map(league.players.map((p) => [p.id, STARTING_RATING]))
  const captured = new Map<string, number>()
  const history = new Map<string, number[]>(league.players.map((p) => [p.id, []]))
  for (const m of playedMatches(league)) {
    const winner = m.result.winnerId
    const loser = opponentOf(m, winner)
    const rw = current.get(winner) ?? STARTING_RATING
    const rl = current.get(loser) ?? STARTING_RATING
    const pts = pointsCaptured(rw, rl)
    current.set(winner, rw + pts)
    current.set(loser, rl - pts)
    captured.set(m.id, pts)
    history.get(winner)?.push(rw + pts)
    history.get(loser)?.push(rl - pts)
  }
  return { current, captured, history }
}

// ---------- per-player stats ----------

export interface PlayerStats {
  player: Player
  played: number
  wins: number
  winsByDefault: number
  losses: number
  rating: number
  peakRating: number
  currentStreak: number
  bestStreak: number
  lastPlayedAt: string | null
}

export interface PodiumStep {
  place: 1 | 2 | 3
  entries: PlayerStats[]
}

export interface HeadToHead {
  opponent: Player
  played: number
  wins: number
  losses: number
  lastPlayedAt: string
  matches: PlayedMatch[]
}

export interface TimelineEntry {
  match: PlayedMatch
  outcome: Outcome
  opponentId: string
  gameNumber: number
  cumulativeWins: number
  /** Rating after this game, and the signed change it caused. */
  rating: number
  change: number
}

export const isPlayed = (m: Match): m is PlayedMatch => m.result !== null

/** Completed games, oldest first. */
export const playedMatches = (league: PublicLeague): PlayedMatch[] =>
  league.matches.filter(isPlayed).sort((a, b) => a.result.playedAt.localeCompare(b.result.playedAt))

export function outcomeFor(match: PlayedMatch, playerId: string): Outcome {
  if (match.result.winnerId !== playerId) return 'loss'
  return match.result.method === 'default' ? 'default-win' : 'win'
}

export const opponentOf = (match: Match, playerId: string) =>
  match.playerIds[0] === playerId ? match.playerIds[1] : match.playerIds[0]

export function computeStats(league: PublicLeague, ratings: Ratings = computeRatings(league)): PlayerStats[] {
  const games = playedMatches(league)
  return league.players.map((player) => {
    const mine = games.filter((m) => m.playerIds.includes(player.id))
    let wins = 0
    let winsByDefault = 0
    let run = 0
    let bestStreak = 0
    for (const m of mine) {
      const o = outcomeFor(m, player.id)
      if (o === 'loss') {
        run = 0
      } else {
        wins++
        if (o === 'default-win') winsByDefault++
        bestStreak = Math.max(bestStreak, ++run)
      }
    }
    return {
      player,
      played: mine.length,
      wins,
      winsByDefault,
      losses: mine.length - wins,
      rating: ratings.current.get(player.id) ?? STARTING_RATING,
      peakRating: Math.max(STARTING_RATING, ...(ratings.history.get(player.id) ?? [])),
      currentStreak: run,
      bestStreak,
      lastPlayedAt: mine.at(-1)?.result.playedAt ?? null,
    }
  })
}

/**
 * Top three places by skill rating among players who've played at least once.
 * Equal ratings share a step (dense ranking), so nobody is split from an equal score by name order.
 */
export function podium(stats: PlayerStats[]): PodiumStep[] {
  const ranked = stats.filter((s) => s.played > 0).sort((a, b) => b.rating - a.rating || a.player.name.localeCompare(b.player.name))
  const steps: PodiumStep[] = []
  for (const s of ranked) {
    const last = steps.at(-1)
    if (last && last.entries[0].rating === s.rating) last.entries.push(s)
    else if (steps.length < 3) steps.push({ place: (steps.length + 1) as 1 | 2 | 3, entries: [s] })
    else break
  }
  return steps
}

export function timeline(league: PublicLeague, playerId: string, ratings: Ratings = computeRatings(league)): TimelineEntry[] {
  let wins = 0
  const history = ratings.history.get(playerId) ?? []
  return playedMatches(league)
    .filter((m) => m.playerIds.includes(playerId))
    .map((match, i) => {
      const outcome = outcomeFor(match, playerId)
      if (outcome !== 'loss') wins++
      const pts = ratings.captured.get(match.id) ?? 0
      return {
        match,
        outcome,
        opponentId: opponentOf(match, playerId),
        gameNumber: i + 1,
        cumulativeWins: wins,
        rating: history[i] ?? STARTING_RATING,
        change: outcome === 'loss' ? -pts : pts,
      }
    })
}

export function headToHead(league: PublicLeague, playerId: string): HeadToHead[] {
  const byOpponent = new Map<string, PlayedMatch[]>()
  for (const m of playedMatches(league)) {
    if (!m.playerIds.includes(playerId)) continue
    const opp = opponentOf(m, playerId)
    byOpponent.set(opp, [...(byOpponent.get(opp) ?? []), m])
  }
  const rows: HeadToHead[] = []
  for (const [oppId, matches] of byOpponent) {
    const opponent = league.players.find((p) => p.id === oppId)
    if (!opponent) continue
    const wins = matches.filter((m) => m.result.winnerId === playerId).length
    rows.push({ opponent, played: matches.length, wins, losses: matches.length - wins, lastPlayedAt: matches.at(-1)!.result.playedAt, matches })
  }
  return rows.sort((a, b) => b.played - a.played || b.lastPlayedAt.localeCompare(a.lastPlayedAt))
}

export interface Highlight {
  id: string
  title: string
  value: string
  detail: string
  playerIds: string[]
}

/** Upbeat-only fun facts — nothing here ever singles out who's losing. */
export function highlights(league: PublicLeague, stats: PlayerStats[]): Highlight[] {
  const out: Highlight[] = []
  const names = (list: PlayerStats[]) => list.map((s) => s.player.name).join(' & ')

  const hot = Math.max(0, ...stats.map((s) => s.currentStreak))
  if (hot >= 2) {
    const who = stats.filter((s) => s.currentStreak === hot)
    out.push({ id: 'streak', title: 'On a roll', value: names(who), detail: `${hot} wins in a row`, playerIds: who.map((s) => s.player.id) })
  }

  const most = Math.max(0, ...stats.map((s) => s.played))
  if (most >= 2) {
    const who = stats.filter((s) => s.played === most)
    if (who.length <= 2) {
      out.push({ id: 'active', title: 'Table regular', value: names(who), detail: `${most} games played`, playerIds: who.map((s) => s.player.id) })
    }
  }

  const pairs = new Map<string, number>()
  for (const m of playedMatches(league)) {
    const k = [...m.playerIds].sort().join(':')
    pairs.set(k, (pairs.get(k) ?? 0) + 1)
  }
  const [topPair, count] = [...pairs].sort((a, b) => b[1] - a[1])[0] ?? []
  if (topPair && count >= 2) {
    const ids = topPair.split(':')
    const pairNames = ids.map((id) => league.players.find((p) => p.id === id)?.name ?? '?').join(' vs ')
    out.push({ id: 'rivalry', title: 'Top rivalry', value: pairNames, detail: `${count} games and counting`, playerIds: ids })
  }

  const clutch = stats.filter((s) => s.bestStreak >= 3).sort((a, b) => b.bestStreak - a.bestStreak)[0]
  if (clutch && clutch.bestStreak > hot) {
    out.push({ id: 'best', title: 'Best run', value: clutch.player.name, detail: `${clutch.bestStreak} straight wins`, playerIds: [clutch.player.id] })
  }

  return out
}

export interface StillToPlay {
  player: Player
  /** Opponents this player has never finished a game against, with the booked game if there is one. */
  remaining: { opponent: Player; booked: Match | null }[]
}

/** Per player, who they still haven't played — most outstanding first. */
export function stillToPlay(league: PublicLeague): { rows: StillToPlay[]; playedPairs: number; totalPairs: number } {
  const played = new Set(playedMatches(league).map((m) => [...m.playerIds].sort().join(':')))
  const bookedFor = (a: string, b: string) =>
    league.matches.find((m) => !m.result && m.scheduledAt && m.playerIds.includes(a) && m.playerIds.includes(b)) ?? null
  const rows = league.players
    .map((player) => ({
      player,
      remaining: league.players
        .filter((o) => o.id !== player.id && !played.has([player.id, o.id].sort().join(':')))
        .map((opponent) => ({ opponent, booked: bookedFor(player.id, opponent.id) })),
    }))
    .sort((a, b) => b.remaining.length - a.remaining.length || a.player.name.localeCompare(b.player.name))
  const n = league.players.length
  const totalPairs = (n * (n - 1)) / 2
  const playedPairs = [...played].filter((k) => k.split(':').every((id) => league.players.some((p) => p.id === id))).length
  return { rows, playedPairs, totalPairs }
}
