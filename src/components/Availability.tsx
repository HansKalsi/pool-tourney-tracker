import { ActionIcon, Chip, Group, Stack, Table, Text, UnstyledButton } from '@mantine/core'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link } from 'react-router'
import { nextOccurrence, PLAY_SLOTS, slotLabel, slotsByDay, slotTimeLabel, type PlaySlot } from '../../shared/slots'
import type { Match, Player, PublicLeague } from '../../shared/types'
import { dayLabel } from '../lib/format'
import { useLeague } from '../lib/league'
import classes from './Availability.module.scss'
import { Avatar } from './Avatar'
import { IconCheck, IconClock } from './icons'

/** Toggling with an optimistic local copy, so taps feel instant even on a slow connection. */
function useAvailability() {
  const { run, archived } = useLeague()
  const [pending, setPending] = useState<Record<string, string[]>>({})
  const slotsFor = (p: Player) => pending[p.id] ?? p.availability ?? []

  async function toggle(p: Player, slotId: string) {
    const current = slotsFor(p)
    const next = PLAY_SLOTS.map((s) => s.id).filter((id) => (id === slotId ? !current.includes(id) : current.includes(id)))
    setPending((m) => ({ ...m, [p.id]: next }))
    await run({ action: 'setAvailability', playerId: p.id, slots: next })
    // Only clear if no newer tap has replaced this one while the request was in flight.
    setPending((m) => {
      if (m[p.id] !== next) return m
      const rest = { ...m }
      delete rest[p.id]
      return rest
    })
  }

  // Archived leagues are frozen, so the toggles are shown but can't be changed.
  return { slotsFor, toggle, locked: archived }
}

/** Players × slots grid on the Players tab. Anyone can tick their own row. */
export function AvailabilityGrid() {
  const { league } = useLeague()
  const { slotsFor, toggle, locked } = useAvailability()
  const players = [...league.players].sort((a, b) => a.name.localeCompare(b.name))
  const counts = PLAY_SLOTS.map((s) => players.filter((p) => slotsFor(p).includes(s.id)).length)
  const best = Math.max(...counts)

  return (
    <div className={classes.tableWrap}>
      <Table className={classes.table} verticalSpacing={6} horizontalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th rowSpan={2} style={{ verticalAlign: 'bottom' }}>
              <Text size="xs" c="dimmed" fw={500}>
                Player
              </Text>
            </Table.Th>
            {slotsByDay().map((d) => (
              <Table.Th key={d.dayName} colSpan={d.slots.length} className={classes.dayHead}>
                {d.dayName}
              </Table.Th>
            ))}
          </Table.Tr>
          <Table.Tr>
            {PLAY_SLOTS.map((s) => (
              <Table.Th key={s.id} className={classes.slotHead}>
                {slotTimeLabel(s)}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {players.map((p) => (
            <Table.Tr key={p.id}>
              <Table.Td>
                <Link to={`/l/${league.id}/players/${p.id}`} className={classes.nameLink}>
                  <Avatar player={p} size="sm" />
                  <span>{p.name}</span>
                </Link>
              </Table.Td>
              {PLAY_SLOTS.map((s) => {
                const on = slotsFor(p).includes(s.id)
                return (
                  <Table.Td key={s.id} className={classes.cell}>
                    <ActionIcon
                      size={36}
                      radius="md"
                      variant={on ? 'filled' : 'default'}
                      aria-pressed={on}
                      aria-label={`${p.name} free ${slotLabel(s)}`}
                      disabled={locked}
                      onClick={() => toggle(p, s.id)}
                    >
                      {on ? <IconCheck size={16} strokeWidth={3} /> : null}
                    </ActionIcon>
                  </Table.Td>
                )
              })}
            </Table.Tr>
          ))}
        </Table.Tbody>
        <Table.Tfoot>
          <Table.Tr>
            <Table.Td>
              <Text size="xs" c="dimmed">
                Free
              </Text>
            </Table.Td>
            {counts.map((c, i) => (
              <Table.Td key={PLAY_SLOTS[i].id} className={classes.count} data-best={(c === best && c > 0) || undefined}>
                {c}
              </Table.Td>
            ))}
          </Table.Tr>
        </Table.Tfoot>
      </Table>
    </div>
  )
}

/** Chip-style editor for a single player (player page). */
export function AvailabilityPicker({ player }: { player: Player }) {
  const { slotsFor, toggle, locked } = useAvailability()
  const mine = slotsFor(player)
  return (
    <Group gap="xl" align="flex-start">
      {slotsByDay().map((d) => (
        <div key={d.dayName}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={6} style={{ letterSpacing: '0.05em' }}>
            {d.dayName}
          </Text>
          <Group gap="xs">
            {d.slots.map((s) => (
              <Chip key={s.id} checked={mine.includes(s.id)} onChange={() => toggle(player, s.id)} radius="xl" disabled={locked}>
                {slotTimeLabel(s)}
              </Chip>
            ))}
          </Group>
        </div>
      ))}
    </Group>
  )
}

/** Next start of `slot` that isn't already booked for another game (there's one table). */
function nextFreeOccurrence(slot: PlaySlot, matches: Match[], ignoreMatchId?: string) {
  const taken = new Set(matches.filter((m) => !m.result && m.scheduledAt && m.id !== ignoreMatchId).map((m) => Date.parse(m.scheduledAt!)))
  let d = nextOccurrence(slot)
  for (let i = 0; i < 8 && taken.has(d.getTime()); i++) d = nextOccurrence(slot, d)
  return d
}

/** Slots both players prefer, each with its next free date, soonest first. */
export function sharedSlots(league: PublicLeague, pair: [string, string], matchId?: string) {
  const [a, b] = pair.map((id) => league.players.find((p) => p.id === id)?.availability ?? [])
  return PLAY_SLOTS.filter((s) => a.includes(s.id) && b.includes(s.id))
    .map((slot) => ({ slot, date: nextFreeOccurrence(slot, league.matches, matchId) }))
    .sort((x, y) => x.date.getTime() - y.date.getTime())
}

/** Booking helper: the next slots both players said suit them. */
export function SuggestedTimes({
  pair,
  matchId,
  selected,
  onPick,
}: {
  pair: [string, string]
  matchId?: string
  selected: string | null
  onPick: (d: Date) => void
}) {
  const { league, player } = useLeague()
  const [a, b] = pair.map((id) => player(id))
  if (!a || !b || a.id === b.id) return null

  const missing = [a, b].filter((p) => !p.availability?.length)
  const shared = sharedSlots(league, pair, matchId)
  const selectedMs = selected ? dayjs(selected).valueOf() : null

  return (
    <div className={classes.suggest}>
      <Group gap={6} mb={8}>
        <IconClock size={16} color="var(--mantine-color-felt-text)" />
        <Text size="sm" fw={500}>
          {shared.length ? 'Both usually free' : 'Preferred times'}
        </Text>
      </Group>
      {shared.length ? (
        <Group gap="xs">
          {shared.map(({ slot, date }) => (
            <UnstyledButton key={slot.id} className={classes.suggestion} data-selected={selectedMs === date.getTime() || undefined} onClick={() => onPick(date)}>
              <Text size="sm" fw={500}>
                {dayLabel(date.toISOString())}
              </Text>
              <Text size="xs" c="dimmed">
                {slotTimeLabel(slot)}
              </Text>
            </UnstyledButton>
          ))}
        </Group>
      ) : (
        <Stack gap={2}>
          {[a, b]
            .filter((p) => p.availability?.length)
            .map((p) => (
              <Text key={p.id} size="sm" c="dimmed">
                <Text span fw={500} c="var(--mantine-color-text)">
                  {p.name}:
                </Text>{' '}
                {PLAY_SLOTS.filter((s) => p.availability!.includes(s.id)).map(slotLabel).join(', ')}
              </Text>
            ))}
          {!missing.length ? (
            <Text size="sm" c="dimmed">
              No slot in common — worth a quick chat.
            </Text>
          ) : null}
        </Stack>
      )}
      {missing.length ? (
        <Text size="xs" c="dimmed" mt={8}>
          {missing.map((p) => p.name).join(' and ')} {missing.length === 1 ? "hasn't" : "haven't"} picked times yet — they can on the Players tab.
        </Text>
      ) : null}
    </div>
  )
}
