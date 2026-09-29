import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Action, ActionResponse, LeagueResponse, Player } from '../../shared/types'
import { useToast } from '../components/Toast'
import { ApiError, fetchLeague, sendAction } from './api'
import { computeRatings, computeStats, type PlayerStats, type Ratings } from './stats'
import { getToken, rememberLeague, setToken } from './storage'

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
export type LeagueAction = DistributiveOmit<Exclude<Action, { action: 'createLeague' }>, 'leagueId'>

interface LeagueContextValue extends LeagueResponse {
  /** Can make changes: a signed-in admin, and the league isn't archived. */
  isAdmin: boolean
  /** Can book games and log results: everyone, unless the league is archived. */
  canBook: boolean
  archived: boolean
  token: string | null
  stats: PlayerStats[]
  ratings: Ratings
  player: (id: string) => Player | undefined
  /** Runs a mutation, updates local state and toasts errors. Resolves to null on failure. */
  run: (action: LeagueAction, successMessage?: string) => Promise<ActionResponse | null>
  signIn: (token: string) => Promise<boolean>
  signOut: () => void
  refresh: () => Promise<void>
}

const LeagueContext = createContext<LeagueContextValue | null>(null)

/**
 * Which pool ball (1–15) a player gets: assigned in the order players joined, so everyone in a
 * league of up to 15 has a different ball. Outside a league it falls back to a stable hash.
 */
export function useBallNumber(playerId: string | undefined): number {
  const ctx = useContext(LeagueContext)
  if (!playerId) return 0
  const index = ctx?.league.players.findIndex((p) => p.id === playerId) ?? -1
  if (index >= 0) return (index % 15) + 1
  let h = 0
  for (const ch of playerId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (h % 15) + 1
}

export function useLeague() {
  const ctx = useContext(LeagueContext)
  if (!ctx) throw new Error('useLeague must be used inside <LeagueProvider>')
  return ctx
}

type LoadState = { status: 'loading' } | { status: 'error'; error: ApiError } | { status: 'ready'; data: LeagueResponse }

const POLL_MS = 30_000

export function useLeagueLoader(leagueId: string) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [token, setTokenState] = useState(() => getToken(leagueId))
  const toast = useToast()
  const tokenRef = useRef(token)
  tokenRef.current = token

  const load = useCallback(async () => {
    try {
      const data = await fetchLeague(leagueId, tokenRef.current)
      // A stored token that no longer works (admin removed) is quietly forgotten.
      if (tokenRef.current && !data.viewer) {
        setToken(leagueId, null)
        setTokenState(null)
      }
      rememberLeague(leagueId, data.league.name)
      setState({ status: 'ready', data })
    } catch (e) {
      const error = e instanceof ApiError ? e : new ApiError(0, String(e))
      // Keep showing stale data if a background refresh fails.
      setState((s) => (s.status === 'ready' && error.status !== 404 && error.status !== 410 ? s : { status: 'error', error }))
    }
  }, [leagueId])

  useEffect(() => {
    setState({ status: 'loading' })
    setTokenState(getToken(leagueId))
    tokenRef.current = getToken(leagueId)
    void load()
  }, [leagueId, load])

  // Light polling so everyone sees new results without refreshing. Paused when the tab is hidden.
  useEffect(() => {
    const tick = () => document.visibilityState === 'visible' && void load()
    const timer = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [load])

  const run = useCallback(
    async (action: LeagueAction, successMessage?: string) => {
      try {
        const res = await sendAction({ ...action, leagueId } as Action, tokenRef.current)
        if (res.token) {
          setToken(leagueId, res.token)
          setTokenState(res.token)
          tokenRef.current = res.token
        }
        if (res.league) {
          const next = { league: res.league, viewer: res.viewer ?? null, invites: res.invites, activity: res.activity }
          if (!next.viewer && tokenRef.current) {
            // We just removed ourselves.
            setToken(leagueId, null)
            setTokenState(null)
          }
          setState({ status: 'ready', data: next })
        }
        if (successMessage) toast(successMessage)
        return res
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Something went wrong', 'error')
        if (e instanceof ApiError && e.status === 409) void load()
        return null
      }
    },
    [leagueId, toast, load],
  )

  const signIn = useCallback(
    async (newToken: string) => {
      try {
        const data = await fetchLeague(leagueId, newToken)
        if (!data.viewer) return false
        setToken(leagueId, newToken)
        setTokenState(newToken)
        tokenRef.current = newToken
        setState({ status: 'ready', data })
        return true
      } catch {
        return false
      }
    },
    [leagueId],
  )

  const signOut = useCallback(() => {
    setToken(leagueId, null)
    setTokenState(null)
    tokenRef.current = null
    setState((s) => (s.status === 'ready' ? { status: 'ready', data: { ...s.data, viewer: null, invites: undefined, activity: undefined } } : s))
  }, [leagueId])

  return { state, token, run, signIn, signOut, refresh: load }
}

export function LeagueProvider({ loader, children }: { loader: ReturnType<typeof useLeagueLoader>; children: ReactNode }) {
  const { state, token, run, signIn, signOut, refresh } = loader
  const data = state.status === 'ready' ? state.data : null

  const value = useMemo<LeagueContextValue | null>(() => {
    if (!data) return null
    const byId = new Map(data.league.players.map((p) => [p.id, p]))
    const ratings = computeRatings(data.league)
    return {
      ...data,
      isAdmin: !!data.viewer && !data.league.archived,
      canBook: !data.league.archived,
      archived: !!data.league.archived,
      token,
      ratings,
      stats: computeStats(data.league, ratings),
      player: (id) => byId.get(id),
      run,
      signIn,
      signOut,
      refresh,
    }
  }, [data, token, run, signIn, signOut, refresh])

  return <LeagueContext.Provider value={value}>{value ? children : null}</LeagueContext.Provider>
}
