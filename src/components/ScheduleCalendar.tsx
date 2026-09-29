import { ActionIcon, Box, Button, Group, Popover, Text, Tooltip, UnstyledButton } from '@mantine/core'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { slotTimeLabel } from '../../shared/slots'
import type { Match } from '../../shared/types'
import { useLeague } from '../lib/league'
import { buildCalendar, unplacedMatchups, weekStart, type CalendarDay, type CalendarItem } from '../lib/schedule'
import { Avatar } from './Avatar'
import { useGameDialogs } from './GameDialogs'
import { HandoffContext, type Handoff } from './Handoff'
import { IconChevronRight, IconPlus, IconTrophy } from './icons'
import { MatchCard } from './MatchCard'
import classes from './ScheduleCalendar.module.scss'

const WEEKS = 2
const time = (d: Date) => dayjs(d).format('HH:mm')

/** Top line of an event: the time on the left, both players' balls on the right. */
function Head({ label, ids }: { label: string; ids?: [string, string] }) {
  const { player } = useLeague()
  return (
    <div className={classes.head}>
      <span className={classes.time}>{label}</span>
      {ids ? (
        <span className={classes.balls}>
          <Avatar player={player(ids[0])} size="xs" />
          <Avatar player={player(ids[1])} size="xs" />
        </span>
      ) : null}
    </div>
  )
}

/** Both names, allowed to wrap so they stay readable in narrow day columns. */
function Names({ ids, winnerId }: { ids: [string, string]; winnerId?: string }) {
  const { player } = useLeague()
  const name = (id: string) => (id === winnerId ? <span className={classes.winner}>{player(id)?.name}</span> : player(id)?.name)
  return (
    <div className={classes.names}>
      {name(ids[0])} <span className={classes.v}>v</span> {name(ids[1])}
    </div>
  )
}

/** A game on the calendar. Clicking opens its full card (with result/booking actions). */
function MatchEvent({ match, at }: { match: Match; at: Date }) {
  const { ratings } = useLeague()
  const state = match.result ? 'played' : at.getTime() < Date.now() ? 'awaiting' : 'booked'
  const captured = ratings.captured.get(match.id)
  const [opened, setOpened] = useState(false)
  // True while a dialog opened from this popover is showing; the popover comes back afterwards.
  const [suspended, setSuspended] = useState(false)
  const handoff = useMemo<Handoff>(() => ({ suspend: () => setSuspended(true), resume: () => setSuspended(false) }), [])
  return (
    <Popover width={360} position="bottom" shadow="lg" withArrow opened={opened && !suspended} onChange={setOpened}>
      <Popover.Target>
        <UnstyledButton className={classes.event} data-state={state} onClick={() => setOpened((o) => !o)} aria-expanded={opened}>
          <Head label={time(at)} ids={match.playerIds} />
          <Names ids={match.playerIds} winnerId={match.result?.winnerId} />
          {match.result ? (
            <span className={classes.cta} style={{ color: 'var(--mantine-color-dimmed)' }}>
              <IconTrophy size={11} /> +{captured}
              {match.result.method === 'default' ? ' · default' : ''}
            </span>
          ) : state === 'awaiting' ? (
            <span className={classes.cta} style={{ color: 'var(--mantine-color-yellow-text)' }}>
              Needs result
            </span>
          ) : null}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown p={0} style={{ border: 0, background: 'transparent' }}>
        <HandoffContext.Provider value={handoff}>
          <MatchCard match={match} />
        </HandoffContext.Provider>
      </Popover.Dropdown>
    </Popover>
  )
}

/** An open office slot: suggests two players who are both free, and books it in one tap for admins. */
function SlotEvent({ item }: { item: Extract<CalendarItem, { kind: 'slot' }> }) {
  const { isAdmin, player } = useLeague()
  const { openBooking } = useGameDialogs()
  const fixture = item.suggestion
  const pair = fixture?.playerIds
  const label = `${slotTimeLabel(item.slot)}`

  if (!pair) {
    const content = <span className={classes.time}>{label} · open</span>
    return isAdmin ? (
      <Tooltip label="No matchup left to book suits this slot — tap to book any game here">
        <UnstyledButton className={classes.event} data-state="slot" onClick={() => openBooking(undefined, undefined, item.at)}>
          {content}
        </UnstyledButton>
      </Tooltip>
    ) : (
      <div className={classes.event} data-state="slot">
        {content}
      </div>
    )
  }

  const names = pair.map((id) => player(id)?.name).join(' and ')
  const content = (
    <>
      <Head label={label} ids={pair} />
      <Names ids={pair} />
      <span className={classes.cta}>
        {isAdmin ? (
          <>
            <IconPlus size={11} /> Book match
          </>
        ) : (
          'Both free'
        )}
      </span>
    </>
  )
  if (!isAdmin) {
    return (
      <Tooltip label={`${names} still need to play each other, and both usually play at this time`}>
        <div className={classes.event} data-state="suggest">
          {content}
        </div>
      </Tooltip>
    )
  }
  return (
    <Tooltip label={`${names} still need to play each other and are both free — tap to book`}>
      <UnstyledButton className={classes.event} data-state="suggest" onClick={() => openBooking(fixture, pair, item.at)}>
        {content}
      </UnstyledButton>
    </Tooltip>
  )
}

const Item = ({ item }: { item: CalendarItem }) =>
  item.kind === 'match' ? <MatchEvent match={item.match} at={item.at} /> : <SlotEvent item={item} />

/** To-book matchups that couldn't be fitted into these two weeks, so nobody gets quietly left out. */
function Unplaced({ weeks }: { weeks: CalendarDay[][] }) {
  const { league, player } = useLeague()
  const items = unplacedMatchups(league, weeks)
  if (!items.length) return null
  const shown = items.slice(0, 3)
  return (
    <div className={classes.unplaced}>
      <strong>Still to book, no slot fits:</strong>{' '}
      {shown.map(({ match, noTimes }, i) => (
        <span key={match.id}>
          {i ? '; ' : ''}
          {player(match.playerIds[0])?.name} v {player(match.playerIds[1])?.name}
          <span className={classes.reason}>
            {' '}
            ({noTimes.length ? `${noTimes.map((id) => player(id)?.name).join(' & ')} ${noTimes.length > 1 ? "haven't" : "hasn't"} picked play times` : 'no shared times'})
          </span>
        </span>
      ))}
      {items.length > shown.length ? ` and ${items.length - shown.length} more` : ''}
    </div>
  )
}

function Legend() {
  return (
    <div className={classes.legend}>
      <span>
        <span className={classes.swatch} data-state="booked" /> Booked
      </span>
      <span>
        <span className={classes.swatch} data-state="suggest" /> Matchup to book — both free
      </span>
      <span>
        <span className={classes.swatch} data-state="awaiting" /> Needs a result
      </span>
      <span>
        <span className={classes.swatch} data-state="played" /> Played
      </span>
    </div>
  )
}

export function ScheduleCalendar() {
  const { league } = useLeague()
  const [offset, setOffset] = useState(0)
  const start = dayjs(weekStart(new Date())).add(offset, 'week').toDate()
  const weeks = buildCalendar(league, start, WEEKS)
  const end = dayjs(start).add(WEEKS * 7 - 1, 'day')
  // Weekends only take up room when something is actually on them.
  const showWeekend = weeks.some((w) => w.slice(5).some((d) => d.items.length))
  const cols = showWeekend ? 7 : 5
  const visible = weeks.map((w) => w.slice(0, cols))
  const sameMonth = dayjs(start).month() === end.month()

  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        <Group gap={4}>
          <ActionIcon variant="default" aria-label="Previous week" onClick={() => setOffset((o) => o - 1)}>
            <IconChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
          </ActionIcon>
          <Button variant="default" size="compact-sm" onClick={() => setOffset(0)} disabled={offset === 0}>
            Today
          </Button>
          <ActionIcon variant="default" aria-label="Next week" onClick={() => setOffset((o) => o + 1)}>
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>
        <span className={classes.range}>
          {dayjs(start).format(sameMonth ? 'D' : 'D MMM')} – {end.format('D MMM YYYY')}
        </span>
      </div>

      {/* Desktop: weeks × days grid */}
      <Box
        visibleFrom="sm"
        className={classes.grid}
        data-weekend={showWeekend || undefined}
        style={{ '--weeks': WEEKS } as React.CSSProperties}
      >
        {visible[0].map((d) => (
          <div key={d.date.toISOString()} className={classes.weekday}>
            {dayjs(d.date).format('ddd')}
          </div>
        ))}
        {visible.flatMap((week, w) =>
          week.map((d, i) => (
            <div
              key={d.date.toISOString()}
              className={classes.day}
              data-past={d.isPast || undefined}
              data-lastcol={i === cols - 1 || undefined}
              data-lastrow={w === WEEKS - 1 || undefined}
            >
              <div className={classes.dayHead} data-today={d.isToday || undefined}>
                <span className={classes.dayNum}>{dayjs(d.date).date()}</span>
                {dayjs(d.date).date() === 1 || (w === 0 && i === 0) ? dayjs(d.date).format('MMM') : null}
              </div>
              {d.items.map((item) => (
                <Item key={item.kind === 'match' ? `match-${item.match.id}` : `slot-${item.at.getTime()}-${item.slot.id}`} item={item} />
              ))}
            </div>
          )),
        )}
      </Box>

      {/* Mobile: a simple day-by-day list */}
      <Box hiddenFrom="sm" className={classes.agenda}>
        {visible.flat().filter((d: CalendarDay) => d.items.length && !d.isPast).length ? (
          visible
            .flat()
            .filter((d) => d.items.length && !d.isPast)
            .map((d) => (
              <div key={d.date.toISOString()} className={classes.agendaDay}>
                <div className={classes.agendaTitle} data-today={d.isToday || undefined}>
                  <span className={classes.dayNum}>{dayjs(d.date).date()}</span>
                  {d.isToday ? 'Today' : dayjs(d.date).format('dddd D MMM')}
                </div>
                {d.items.map((item) => (
                  <Item key={item.kind === 'match' ? `match-${item.match.id}` : `slot-${item.at.getTime()}-${item.slot.id}`} item={item} />
                ))}
              </div>
            ))
        ) : (
          <Text size="sm" c="dimmed" ta="center" py="md">
            Nothing on these two weeks yet.
          </Text>
        )}
      </Box>

      <Unplaced weeks={weeks} />
      <Legend />
    </div>
  )
}
