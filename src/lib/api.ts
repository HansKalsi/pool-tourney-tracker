import type { Action, ActionResponse, LeagueResponse } from '../../shared/types'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(init: RequestInit & { token?: string | null; query?: string }): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (init.token) headers['x-admin-token'] = init.token
  let res: Response
  try {
    res = await fetch(`/api/league${init.query ?? ''}`, { ...init, headers })
  } catch {
    throw new ApiError(0, "Couldn't reach the server — check your connection.")
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`)
  return data as T
}

export const fetchLeague = (id: string, token: string | null) =>
  request<LeagueResponse>({ method: 'GET', token, query: `?id=${encodeURIComponent(id)}` })

export const sendAction = (action: Action, token: string | null) =>
  request<ActionResponse>({ method: 'POST', token, body: JSON.stringify(action) })
