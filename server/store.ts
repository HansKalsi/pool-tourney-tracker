import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { Redis } from '@upstash/redis'
import type { ActivityEntry, AdminPublic, PublicLeague } from '../shared/types.js'

export interface StoredAdmin extends AdminPublic {
  tokenHash: string
}

export interface StoredInvite {
  id: string
  codeHash: string
  createdBy: string
  createdAt: string
  expiresAt: string
}

export interface StoredLeague extends Omit<PublicLeague, 'admins'> {
  admins: StoredAdmin[]
  invites: StoredInvite[]
  /** Admin-only activity log, oldest first. Missing on leagues created before the log existed. */
  activity?: ActivityEntry[]
}

export interface Store {
  get(id: string): Promise<StoredLeague | null>
  /**
   * Writes `league` only if the stored copy is still at `expectedVersion`
   * (0 = must not exist yet). Returns false when someone else wrote first.
   */
  compareAndSet(league: StoredLeague, expectedVersion: number): Promise<boolean>
  delete(id: string): Promise<void>
}

const key = (id: string) => `league:${id}`

// Atomic compare-and-set so two admins saving at the same moment can't clobber each other.
const CAS_SCRIPT = `
local cur = redis.call('GET', KEYS[1])
local expected = tonumber(ARGV[2])
if cur then
  if cjson.decode(cur).version ~= expected then return 0 end
elseif expected ~= 0 then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1])
return 1
`

class RedisStore implements Store {
  private redis: Redis
  constructor(redis: Redis) {
    this.redis = redis
  }

  async get(id: string) {
    const raw = await this.redis.get<string>(key(id))
    return raw ? (JSON.parse(raw) as StoredLeague) : null
  }

  async compareAndSet(league: StoredLeague, expectedVersion: number) {
    const ok = await this.redis.eval(CAS_SCRIPT, [key(league.id)], [JSON.stringify(league), String(expectedVersion)])
    return Number(ok) === 1
  }

  async delete(id: string) {
    await this.redis.del(key(id))
  }
}

/** Local development only: one JSON file per league in ./.data */
class FileStore implements Store {
  private dir: string
  constructor(dir: string) {
    this.dir = dir
    mkdirSync(dir, { recursive: true })
  }

  private path(id: string) {
    return join(this.dir, `${id.replace(/[^a-z0-9]/gi, '')}.json`)
  }

  async get(id: string) {
    const p = this.path(id)
    return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as StoredLeague) : null
  }

  async compareAndSet(league: StoredLeague, expectedVersion: number) {
    const current = await this.get(league.id)
    if ((current?.version ?? 0) !== expectedVersion) return false
    writeFileSync(this.path(league.id), JSON.stringify(league, null, 2))
    return true
  }

  async delete(id: string) {
    rmSync(this.path(id), { force: true })
  }
}

export class StorageNotConfiguredError extends Error {}

let store: Store | undefined

export function getStore(): Store {
  if (store) return store
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    store = new RedisStore(new Redis({ url, token, automaticDeserialization: false }))
  } else if (process.env.VERCEL) {
    // Vercel's filesystem is read-only/ephemeral, so silently falling back would lose data.
    throw new StorageNotConfiguredError(
      'No database connected. In your Vercel project, open Storage → add an Upstash Redis database, connect it, then redeploy.',
    )
  } else {
    store = new FileStore(process.env.LOCAL_DATA_DIR ?? join(process.cwd(), '.data'))
  }
  return store
}

/** For tests. */
export function setStore(s: Store | undefined) {
  store = s
}
