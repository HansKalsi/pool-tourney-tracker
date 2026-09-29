import { ActionIcon, Badge, Button, Card, Menu, Text } from '@mantine/core'
import { Link } from 'react-router'
import type { Match } from '../../shared/types'
import { dateTimeLabel, inlineDay } from '../lib/format'
import { downloadIcs } from '../lib/ics'
import { useLeague } from '../lib/league'
import { pointsInPlay } from '../lib/stats'
import { Avatar } from './Avatar'
import { useConfirm } from './Confirm'
import { useGameDialogs } from './GameDialogs'
import { IconCalendarClock, IconCalendarPlus, IconDots, IconMapPin, IconPencil, IconTrash, IconTrophy } from './icons'
import classes from './MatchCard.module.scss'

function Side({ id, align, winner, captured, opponentId }: { id: string; align: 'left' | 'right'; winner?: boolean; captured?: number; opponentId?: string }) {
  const { player, league, ratings } = useLeague()
  const p = player(id)
  // For games not yet played: what this player would capture with a win.
  const stake = opponentId ? pointsInPlay(ratings, id, opponentId)[id] : undefined
  return (
    <Link to={`/l/${league.id}/players/${id}`} className={classes.side} data-align={align}>
      <Avatar player={p} size="md" />
      <div style={{ minWidth: 0 }}>
        <Text className={classes.name} fw={winner ? 700 : 500}>
          {p?.name ?? 'Unknown'}
        </Text>
        {winner ? (
          <Badge variant="light" size="sm" radius="xl" leftSection={<IconTrophy size={11} />} mt={2} tt="none">
            Won{captured ? ` +${captured}` : ''}
          </Badge>
        ) : null}
        {stake !== undefined ? (
          <div className={classes.stake} title={`${p?.name} captures ${stake} points from ${player(opponentId!)?.name} with a win`}>
            {ratings.current.get(id)} · <strong>+{stake}</strong> to win
          </div>
        ) : null}
      </div>
    </Link>
  )
}

export function MatchCard({ match }: { match: Match }) {
  const { canBook, ratings } = useLeague()
  const { openBooking, openResult } = useGameDialogs()
  const result = match.result
  const [a, b] = match.playerIds
  const overdue = !result && !!match.scheduledAt && Date.parse(match.scheduledAt) < Date.now()

  return (
    <Card padding="md" className={classes.card}>
      <div className={classes.sides}>
        <Side id={a} align="left" winner={result?.winnerId === a} captured={ratings.captured.get(match.id)} opponentId={result ? undefined : b} />
        <span className={classes.vs}>vs</span>
        <Side id={b} align="right" winner={result?.winnerId === b} captured={ratings.captured.get(match.id)} opponentId={result ? undefined : a} />
      </div>
      <div className={classes.footer}>
        {result ? (
          <span>
            Played {inlineDay(result.playedAt)}
            {result.method === 'default' ? ' · won by default' : ''}
          </span>
        ) : match.scheduledAt ? (
          <span className={classes.meta}>
            <IconCalendarClock size={16} />
            {dateTimeLabel(match.scheduledAt)}
          </span>
        ) : (
          <span>Not booked yet</span>
        )}
        {match.location ? (
          <span className={classes.meta}>
            <IconMapPin size={16} />
            {match.location}
          </span>
        ) : null}
        {overdue ? (
          <Badge color="yellow" variant="light" radius="xl" tt="none">
            Awaiting result
          </Badge>
        ) : null}
        <div className={classes.actions}>
          {canBook && overdue ? (
            <Button size="compact-sm" onClick={() => openResult(match)}>
              Enter result
            </Button>
          ) : null}
          {canBook && !result && !match.scheduledAt ? (
            <Button size="compact-sm" variant="default" onClick={() => openBooking(match)}>
              Book
            </Button>
          ) : null}
          <MatchMenu match={match} />
        </div>
      </div>
    </Card>
  )
}

/**
 * The "⋯" menu for a game. Everyone: add to calendar, book an unbooked game, enter a missing result.
 * Admins also: change a booking, edit a result, delete the game.
 */
export function MatchMenu({ match }: { match: Match }) {
  const { isAdmin, canBook, run, league, player } = useLeague()
  const { openBooking, openResult } = useGameDialogs()
  const confirm = useConfirm()
  const result = match.result
  const [a, b] = match.playerIds
  const canCalendar = !!match.scheduledAt && !result
  const canSetTime = !result && (isAdmin || (canBook && !match.scheduledAt))
  const canSetResult = isAdmin || (canBook && !result)
  if (!isAdmin && !canCalendar && !canSetTime && !canSetResult) return null

  const deleteGame = () =>
    confirm({
      title: 'Delete this game?',
      message: `${player(a)?.name} vs ${player(b)?.name}${result ? ' — its result and rating points will be removed too' : ''}. This can't be undone.`,
      confirmLabel: 'Delete game',
      danger: true,
      onConfirm: async () => !!(await run({ action: 'deleteMatch', matchId: match.id }, 'Game deleted')),
    })

  return (
    <Menu>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label="More options">
          <IconDots size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {canCalendar ? (
          <Menu.Item leftSection={<IconCalendarPlus size={16} />} onClick={() => downloadIcs(match, league.players, league.name)}>
            Add to calendar
          </Menu.Item>
        ) : null}
        {canSetTime ? (
          <Menu.Item leftSection={<IconCalendarClock size={16} />} onClick={() => openBooking(match)}>
            {match.scheduledAt ? 'Change booking' : 'Book a time'}
          </Menu.Item>
        ) : null}
        {canSetResult ? (
          <Menu.Item leftSection={<IconPencil size={16} />} onClick={() => openResult(match)}>
            {result ? 'Edit result' : 'Enter result'}
          </Menu.Item>
        ) : null}
        {isAdmin ? (
          <>
            <Menu.Divider />
            <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={deleteGame}>
              Delete game
            </Menu.Item>
          </>
        ) : null}
      </Menu.Dropdown>
    </Menu>
  )
}
