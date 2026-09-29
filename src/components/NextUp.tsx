import { Anchor, Card, Group, Text, Title } from '@mantine/core'
import dayjs from 'dayjs'
import { Link } from 'react-router'
import { dayLabel } from '../lib/format'
import { useLeague } from '../lib/league'
import { pointsInPlay } from '../lib/stats'
import { Avatar } from './Avatar'
import { IconCalendarClock, IconMapPin } from './icons'
import classes from './NextUp.module.scss'
import { Empty } from './ui'

/** Every booked game on the next day there's something on — the "what's happening" headline. */
export function NextUp() {
  const { league, player, ratings } = useLeague()
  const now = Date.now()
  const future = league.matches
    .filter((m) => !m.result && m.scheduledAt && Date.parse(m.scheduledAt) >= now)
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))
  const day = future[0] ? dayjs(future[0].scheduledAt) : null
  const games = day ? future.filter((m) => dayjs(m.scheduledAt).isSame(day, 'day')) : []
  const later = future.length - games.length

  return (
    <Card padding="md">
      <Group justify="space-between" align="baseline" mb={4}>
        <Title order={2} fz="md" fw={650}>
          Next up{day ? ` · ${dayLabel(day.toISOString())}` : ''}
        </Title>
        <Anchor component={Link} to="games" size="xs" fw={500}>
          {later > 0 ? `+${later} more booked · calendar` : 'Calendar'}
        </Anchor>
      </Group>
      {games.length ? (
        games.map((m) => {
          const [a, b] = m.playerIds
          const stakes = pointsInPlay(ratings, a, b)
          return (
            <div key={m.id} className={classes.game}>
              <span className={classes.time}>{dayjs(m.scheduledAt).format('HH:mm')}</span>
              <div className={classes.players}>
                <Link to={`players/${a}`}>
                  <Avatar player={player(a)} size="sm" />
                  <span>{player(a)?.name}</span>
                </Link>
                <span className={classes.v}>v</span>
                <Link to={`players/${b}`}>
                  <Avatar player={player(b)} size="sm" />
                  <span>{player(b)?.name}</span>
                </Link>
              </div>
              <div className={classes.meta}>
                {m.location ? (
                  <>
                    <IconMapPin size={12} style={{ verticalAlign: -2 }} /> {m.location}
                  </>
                ) : (
                  'Location not set'
                )}
              </div>
              <div className={classes.stakes} title="Rating points each player captures with a win">
                {player(a)?.name} <strong>+{stakes[a]}</strong>
                <br />
                {player(b)?.name} <strong>+{stakes[b]}</strong>
              </div>
            </div>
          )
        })
      ) : (
        <Empty icon={<IconCalendarClock size={24} />} title="No games booked yet">
          <Text size="sm" c="dimmed" span>
            Upcoming games will show here once they're booked.
          </Text>
        </Empty>
      )}
    </Card>
  )
}
