import { Card, Group, Progress, Text, Title, Tooltip, UnstyledButton } from '@mantine/core'
import { Link } from 'react-router'
import type { Player } from '../../shared/types'
import { dateTimeLabel } from '../lib/format'
import { useLeague } from '../lib/league'
import { stillToPlay, type StillToPlay as Row } from '../lib/stats'
import { Avatar } from './Avatar'
import { useGameDialogs } from './GameDialogs'
import { IconCheck } from './icons'
import classes from './StillToPlay.module.scss'

/** Opponent balls someone still has to play. Admins can tap one to book (or re-book) that game. */
export function OpponentBalls({ player, remaining }: { player: Player; remaining: Row['remaining'] }) {
  const { isAdmin, league } = useLeague()
  const { openBooking } = useGameDialogs()
  return (
    <div className={classes.opponents}>
      {remaining.map(({ opponent, booked }) => {
        const label = booked
          ? `${player.name} v ${opponent.name} — booked ${dateTimeLabel(booked.scheduledAt!)}`
          : `${player.name} hasn't played ${opponent.name} yet${isAdmin ? ' — tap to book' : ''}`
        const ball = <Avatar player={opponent} size="xs" />
        if (!isAdmin) {
          return (
            <Tooltip key={opponent.id} label={label}>
              <span className={classes.opp} data-booked={booked ? true : undefined}>
                {ball}
              </span>
            </Tooltip>
          )
        }
        // Prefer the existing game for this pair (booked or waiting) so we never create duplicates.
        const existing =
          booked ?? league.matches.find((m) => !m.result && m.playerIds.includes(player.id) && m.playerIds.includes(opponent.id))
        return (
          <Tooltip key={opponent.id} label={label}>
            <UnstyledButton
              className={classes.opp}
              data-booked={booked ? true : undefined}
              aria-label={label}
              onClick={() => openBooking(existing, [player.id, opponent.id])}
            >
              {ball}
            </UnstyledButton>
          </Tooltip>
        )
      })}
    </div>
  )
}

export function StillToPlayPanel() {
  const { league } = useLeague()
  const { rows, playedPairs, totalPairs } = stillToPlay(league)
  const pct = totalPairs ? (playedPairs / totalPairs) * 100 : 0
  return (
    <Card padding="md">
      <Group justify="space-between" align="baseline" mb={4}>
        <Title order={2} fz="md" fw={650}>
          Still to play
        </Title>
        <Text size="xs" c="dimmed" className="tabular">
          {playedPairs}/{totalPairs} pairings played
        </Text>
      </Group>
      <Progress value={pct} size="sm" radius="xl" mb="xs" aria-label={`${Math.round(pct)}% of pairings played`} />
      {rows.map(({ player, remaining }) => (
        <div key={player.id} className={classes.row}>
          <Link to={`/l/${league.id}/players/${player.id}`} className={classes.who}>
            <Avatar player={player} size="xs" />
            <span>{player.name}</span>
          </Link>
          {remaining.length ? (
            <>
              <OpponentBalls player={player} remaining={remaining} />
            </>
          ) : (
            <span className={classes.done}>
              <IconCheck size={12} style={{ verticalAlign: -1 }} /> Played everyone
            </span>
          )}
        </div>
      ))}
      <div className={classes.key}>
        <span className={classes.keyBall} /> To arrange
        <span className={classes.keyBall} data-faded style={{ marginLeft: 8 }} /> Booked
      </div>
    </Card>
  )
}
