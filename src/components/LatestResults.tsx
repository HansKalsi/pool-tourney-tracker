import { Text } from '@mantine/core'
import { dayLabel } from '../lib/format'
import { useLeague } from '../lib/league'
import { opponentOf, playedMatches } from '../lib/stats'
import { Avatar } from './Avatar'
import { IconTrophy } from './icons'
import classes from './LatestResults.module.scss'
import { Empty } from './ui'

/** Compact "who won" feed for the side panel. Leads with the winner, so it reads positively. */
export function LatestResults({ limit = 8 }: { limit?: number }) {
  const { league, player, ratings } = useLeague()
  const games = playedMatches(league).reverse().slice(0, limit)
  if (!games.length) return <Empty title="No results yet">They show up here as soon as they're entered.</Empty>
  return (
    <div className={classes.list}>
      {games.map((m) => {
        const winner = player(m.result.winnerId)
        const other = player(opponentOf(m, m.result.winnerId))
        return (
          <div key={m.id} className={classes.row}>
            <span className={classes.balls}>
              <Avatar player={winner} size="sm" />
              <Avatar player={other} size="sm" />
            </span>
            <div className={classes.text}>
              <div className={classes.names}>
                <IconTrophy size={12} style={{ marginRight: 4, verticalAlign: -1, color: 'var(--mantine-color-felt-text)' }} />
                <Text span fw={600} size="sm">
                  {winner?.name}
                </Text>{' '}
                <Text span c="dimmed" size="sm">
                  won vs
                </Text>{' '}
                {other?.name}
              </div>
              <div className={classes.meta}>
                {dayLabel(m.result.playedAt)}
                {m.result.method === 'default' ? ' · by default' : ''}
              </div>
            </div>
            <span className={classes.points}>+{ratings.captured.get(m.id)}</span>
          </div>
        )
      })}
    </div>
  )
}
