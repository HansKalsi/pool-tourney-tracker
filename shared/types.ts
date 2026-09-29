// Types shared by the React app and the API. Type-only: nothing here exists at runtime.

/** How a game was won. "default" = the opponent potted the black (8-ball) early / illegally. */
export type ResultMethod = 'standard' | 'default'

export interface Player {
  id: string
  name: string
  createdAt: string
  /** Ids from PLAY_SLOTS (shared/slots.ts) the player prefers. Missing on players created before this existed. */
  availability?: string[]
}

export interface MatchResult {
  winnerId: string
  method: ResultMethod
  playedAt: string
}

export interface Match {
  id: string
  playerIds: [string, string]
  /** ISO timestamp of the booked slot, or null if the matchup hasn't been booked yet. */
  scheduledAt: string | null
  location: string | null
  result: MatchResult | null
  createdAt: string
}

export interface AdminPublic {
  id: string
  name: string
  isOwner: boolean
  createdAt: string
}

export interface InvitePublic {
  id: string
  createdBy: string
  createdAt: string
  expiresAt: string
}

export interface PublicLeague {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  version: number
  players: Player[]
  matches: Match[]
  admins: AdminPublic[]
  /** Set when the creator archives the league: hidden from visitors, read-only for admins, nothing deleted. */
  archived?: { at: string; by: string } | null
}

export interface Viewer {
  adminId: string
  name: string
  isOwner: boolean
}

export type ActivityCategory = 'games' | 'players' | 'admin'

/** One line in the admin activity log. */
export interface ActivityEntry {
  id: string
  at: string
  /** Admin who did it, or null for someone who wasn't signed in (e.g. setting play times). */
  actor: string | null
  /** True when `actor` is the player someone said they were, without being signed in as an admin. */
  claimed?: boolean
  action: ActionName
  category: ActivityCategory
  /** Plain-English description, e.g. "entered a result: Hans won vs Chloe". */
  text: string
  /** A game time the entry refers to — formatted by the browser so it's in local time. */
  when?: string
}

export interface LeagueResponse {
  league: PublicLeague
  /** The admin making the request, or null for public viewers. */
  viewer: Viewer | null
  /** Only returned to admins. */
  invites?: InvitePublic[]
  /** Only returned to admins, newest first. */
  activity?: ActivityEntry[]
}

export interface ResultInput {
  winnerId: string
  method: ResultMethod
  playedAt: string
}

/** Every mutation the API understands. All except createLeague/redeemInvite/setAvailability need an admin token. */
export type Action =
  | { action: 'createLeague'; name: string; adminName: string; players: string[] }
  | { action: 'redeemInvite'; leagueId: string; code: string; name: string }
  | { action: 'renameLeague'; leagueId: string; name: string }
  | { action: 'archiveLeague'; leagueId: string }
  | { action: 'restoreLeague'; leagueId: string }
  /** Permanent — only allowed once the league is archived. */
  | { action: 'deleteLeague'; leagueId: string }
  | { action: 'addPlayers'; leagueId: string; names: string[] }
  | { action: 'renamePlayer'; leagueId: string; playerId: string; name: string }
  | { action: 'removePlayer'; leagueId: string; playerId: string }
  /** Public — anyone with the link can say when they're free. */
  | { action: 'setAvailability'; leagueId: string; playerId: string; slots: string[] }
  /*
   * Booking and logging results are open to everyone (with `by` = the player they say they are).
   * Changing or removing what's already there — existing results or bookings — stays admin-only.
   */
  | {
      action: 'createMatch'
      leagueId: string
      playerIds: [string, string]
      scheduledAt: string | null
      location: string | null
      result: ResultInput | null
      by?: string
    }
  | { action: 'updateMatch'; leagueId: string; matchId: string; scheduledAt: string | null; location: string | null; by?: string }
  | { action: 'setResult'; leagueId: string; matchId: string; result: ResultInput | null; by?: string }
  | { action: 'deleteMatch'; leagueId: string; matchId: string }
  | { action: 'generateFixtures'; leagueId: string; scope: 'unplayed' | 'all' }
  | { action: 'createInvite'; leagueId: string }
  | { action: 'revokeInvite'; leagueId: string; inviteId: string }
  | { action: 'removeAdmin'; leagueId: string; adminId: string }

export type ActionName = Action['action']

export interface ActionResponse extends Partial<LeagueResponse> {
  /** Returned by createLeague and redeemInvite — the caller's new admin token. */
  token?: string
  /** Returned by createInvite — shown once, only the hash is stored. */
  code?: string
  deleted?: boolean
}

export interface ApiError {
  error: string
}
