import { Badge, Button } from '@mantine/core'
import dayjs from 'dayjs'
import { Link } from 'react-router'
import { slotLabel } from '../../shared/slots'
import type { Match } from '../../shared/types'
import { dayLabel } from '../lib/format'
import { useLeague } from '../lib/league'
import { sharedSlots } from './Availability'
import { Avatar } from './Avatar'
import { useGameDialogs } from './GameDialogs'
import classes from './GameRow.module.scss'
import { IconMapPin, IconTrophy } from './icons'
import { MatchMenu } from './MatchCard'

/** One game on one line — used for every list in the Games tab. */
export function GameRow({ match }: { match: Match }) {
  const { league, player, ratings, isAdmin } = useLeague()
  const { openBooking, openResult } = useGameDialogs()
  const result = match.result
  const when = result?.playedAt ?? match.scheduledAt
  const awaiting = !result && !!match.scheduledAt && Date.parse(match.scheduledAt) < Date.now()
  // For unbooked games, the next office slot both players like is the most useful hint.
  const nextShared = !result && !match.scheduledAt ? sharedSlots(league, match.playerIds, match.id)[0] : undefined

  const side = (id: string) => {
    const won = result?.winnerId === id
    return (
      <Link to={`/l/${league.id}/players/${id}`} className={classes.player} data-winner={won || undefined}>
        <Avatar player={player(id)} size="xs" />
        {won ? <IconTrophy size={12} className={classes.trophy} /> : null}
        <span>{player(id)?.name}</span>
      </Link>
    )
  }

  return (
    <div className={classes.row}>
      <span className={classes.date}>{when ? dayLabel(when) : '—'}</span>
      <span className={classes.time}>{when ? dayjs(when).format('HH:mm') : ''}</span>
      <div className={classes.players}>
        {side(match.playerIds[0])}
        <span className={classes.v}>v</span>
        {side(match.playerIds[1])}
      </div>
      <div className={classes.detail}>
        {result ? (
          <>
            <span className={classes.points}>+{ratings.captured.get(match.id)}</span>
            {result.method === 'default' ? <span>by default</span> : null}
          </>
        ) : awaiting ? (
          <Badge color="yellow" variant="light" size="sm" radius="xl" tt="none">
            Needs result
          </Badge>
        ) : match.scheduledAt ? (
          match.location ? (
            <span>
              <IconMapPin size={12} style={{ verticalAlign: -1 }} /> {match.location}
            </span>
          ) : null
        ) : nextShared ? (
          <span>Both free {slotLabel(nextShared.slot)}</span>
        ) : (
          <span>No shared times</span>
        )}
      </div>
      <div className={classes.actions}>
        {isAdmin && awaiting ? (
          <Button size="compact-xs" onClick={() => openResult(match)}>
            Enter result
          </Button>
        ) : null}
        {isAdmin && !result && !match.scheduledAt ? (
          <Button size="compact-xs" variant="default" onClick={() => openBooking(match)}>
            Book
          </Button>
        ) : null}
        <MatchMenu match={match} />
      </div>
    </div>
  )
}

export function GameList({ matches }: { matches: Match[] }) {
  return (
    <div className={classes.list}>
      {matches.map((m) => (
        <GameRow key={m.id} match={m} />
      ))}
    </div>
  )
}
