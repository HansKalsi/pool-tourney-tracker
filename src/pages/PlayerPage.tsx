import { ActionIcon, Anchor, Badge, Box, Card, Collapse, Group, SimpleGrid, Stack, Table, Tabs, Text, Title, Tooltip, UnstyledButton } from '@mantine/core'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AvailabilityPicker } from '../components/Availability'
import { Avatar } from '../components/Avatar'
import { useConfirm } from '../components/Confirm'
import { useGameDialogs } from '../components/GameDialogs'
import { IconArrowLeft, IconChevronDown, IconPencil, IconTrash } from '../components/icons'
import { RatingChart } from '../components/RatingChart'
import { Empty } from '../components/ui'
import { dayLabel, inlineDay, plural, shortDate } from '../lib/format'
import { useLeague } from '../lib/league'
import { headToHead, outcomeFor, timeline, type HeadToHead, type Outcome } from '../lib/stats'
import classes from './PlayerPage.module.scss'

const OUTCOME_LABEL: Record<Outcome, string> = { win: 'Win', 'default-win': 'Win by default', loss: 'Loss' }

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  // Losses stay neutral grey — no red, nothing that reads as a scolding.
  return (
    <Badge variant="light" color={outcome === 'loss' ? 'gray' : 'felt'} radius="xl" tt="none" fw={500}>
      {OUTCOME_LABEL[outcome]}
    </Badge>
  )
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card padding="sm">
      <div className={classes.statLabel}>{label}</div>
      <div className={classes.statValue}>{value}</div>
      {sub ? (
        <Text size="xs" c="dimmed">
          {sub}
        </Text>
      ) : null}
    </Card>
  )
}

function RivalRow({ row, playerId }: { row: HeadToHead; playerId: string }) {
  const { league } = useLeague()
  const [open, setOpen] = useState(false)
  const total = row.wins + row.losses
  return (
    <Card padding={0}>
      <UnstyledButton className={classes.rivalToggle} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Avatar player={row.opponent} size="md" />
        <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text fw={600} truncate>
              vs {row.opponent.name}
            </Text>
            <Text size="sm" className="tabular" style={{ flexShrink: 0 }}>
              <strong>{row.wins}</strong>
              <Text span c="dimmed">
                {' '}
                – {row.losses}
              </Text>
            </Text>
          </Group>
          <div className={classes.record} aria-hidden>
            {row.wins ? <span className={classes.recordWins} style={{ width: `${(row.wins / total) * 100}%` }} /> : null}
            {row.losses ? <span className={classes.recordOther} style={{ width: `${(row.losses / total) * 100}%` }} /> : null}
          </div>
          <Text size="xs" c="dimmed">
            {plural(row.played, 'game')} · last {shortDate(row.lastPlayedAt)}
          </Text>
        </Stack>
        <IconChevronDown size={20} className={classes.chevron} data-open={open || undefined} />
      </UnstyledButton>
      <Collapse expanded={open}>
        <div className={classes.rivalGames}>
          {[...row.matches].reverse().map((m) => (
            <div key={m.id} className={classes.rivalGame}>
              <Text size="sm" c="dimmed">
                {dayLabel(m.result.playedAt)}
              </Text>
              <OutcomeBadge outcome={outcomeFor(m, playerId)} />
            </div>
          ))}
          <div className={classes.rivalGame} style={{ justifyContent: 'flex-end' }}>
            <Anchor component={Link} to={`/l/${league.id}/players/${row.opponent.id}`} size="sm" fw={500}>
              View {row.opponent.name} →
            </Anchor>
          </div>
        </div>
      </Collapse>
    </Card>
  )
}

export default function PlayerPage() {
  const { playerId = '' } = useParams()
  const { league, stats, ratings, isAdmin, canBook, run, player } = useLeague()
  const { openBooking } = useGameDialogs()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const s = stats.find((x) => x.player.id === playerId)

  if (!s) {
    return (
      <Empty title="Player not found">
        <Anchor component={Link} to={`/l/${league.id}/players`} fw={500}>
          Back to players
        </Anchor>
      </Empty>
    )
  }

  const p = s.player
  const entries = timeline(league, p.id, ratings)
  const rivals = headToHead(league, p.id)
  const upcoming = league.matches
    .filter((m) => !m.result && m.playerIds.includes(p.id))
    .sort((a, b) => (a.scheduledAt ?? '￿').localeCompare(b.scheduledAt ?? '￿'))

  const rename = () =>
    confirm({
      title: 'Rename player',
      confirmLabel: 'Save',
      input: { label: 'Name', initial: p.name, maxLength: 40 },
      onConfirm: async (name) => name === p.name || !!(await run({ action: 'renamePlayer', playerId: p.id, name }, 'Player renamed')),
    })

  const remove = () =>
    confirm({
      title: `Remove ${p.name}?`,
      message: "They haven't played yet, so nobody's stats change. Any games waiting to be booked for them are removed too.",
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: async () => {
        const res = await run({ action: 'removePlayer', playerId: p.id }, `${p.name} removed`)
        if (!res) return false
        navigate(`/l/${league.id}/players`)
      },
    })

  const gamesTable = (
    <Table.ScrollContainer minWidth={420}>
      <Table verticalSpacing="xs" horizontalSpacing="md" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            <Table.Th>Date</Table.Th>
            <Table.Th>Opponent</Table.Th>
            <Table.Th ta="right">Result</Table.Th>
            <Table.Th ta="right">Rating</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {[...entries].reverse().map((e) => (
            <Table.Tr key={e.match.id}>
              <Table.Td c="dimmed" className="tabular">
                {e.gameNumber}
              </Table.Td>
              <Table.Td style={{ whiteSpace: 'nowrap' }}>{shortDate(e.match.result.playedAt)}</Table.Td>
              <Table.Td>
                <Anchor component={Link} to={`/l/${league.id}/players/${e.opponentId}`} c="inherit" size="sm">
                  {player(e.opponentId)?.name}
                </Anchor>
              </Table.Td>
              <Table.Td ta="right">
                <OutcomeBadge outcome={e.outcome} />
              </Table.Td>
              <Table.Td ta="right" className="tabular" style={{ whiteSpace: 'nowrap' }}>
                <strong>{e.rating}</strong>{' '}
                <span className={e.change > 0 ? classes.plus : classes.minus}>
                  ({e.change > 0 ? '+' : '−'}
                  {Math.abs(e.change)})
                </span>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )

  return (
    <div className={classes.layout}>
      <section className={classes.col}>
        <div>
          <Link to={`/l/${league.id}/players`} className={classes.back}>
            <IconArrowLeft size={16} /> All players
          </Link>
          <Group wrap="nowrap" gap="md">
            <Avatar player={p} size="xl" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Title order={2} fz={26} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </Title>
              <Text size="sm" c="dimmed">
                {s.played ? `Last played ${inlineDay(s.lastPlayedAt!)}` : 'Yet to play their first game'}
                {s.currentStreak >= 2 ? ` · 🔥 ${s.currentStreak} wins in a row` : ''}
              </Text>
            </div>
            {isAdmin ? (
              <Group gap={4} wrap="nowrap">
                <Tooltip label="Rename">
                  <ActionIcon variant="subtle" color="gray" size="lg" onClick={rename} aria-label="Rename player">
                    <IconPencil size={18} />
                  </ActionIcon>
                </Tooltip>
                {!s.played ? (
                  <Tooltip label="Remove">
                    <ActionIcon variant="subtle" color="red" size="lg" onClick={remove} aria-label="Remove player">
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Tooltip>
                ) : null}
              </Group>
            ) : null}
          </Group>
        </div>

        <SimpleGrid cols={2} spacing="xs">
          <Stat label="Skill rating" value={s.rating} sub={s.played ? `Peak ${s.peakRating}` : 'Everyone starts here'} />
          <Stat label="Games" value={s.played} />
          <Stat label="Wins" value={s.wins} sub={s.winsByDefault ? `incl. ${s.winsByDefault} by default` : undefined} />
          <Stat label="Best run" value={s.bestStreak} sub={s.bestStreak === 1 ? 'win' : 'wins in a row'} />
        </SimpleGrid>

        <div>
          <Text size="sm" fw={650} mb={6}>
            Best times to play
          </Text>
          <AvailabilityPicker player={p} />
        </div>

        {upcoming.length ? (
          <div>
            <Text size="sm" fw={650} mb={6}>
              Coming up
            </Text>
            <Group gap="xs">
              {upcoming.map((m) => {
                const opp = player(m.playerIds.find((id) => id !== p.id)!)
                const content = (
                  <>
                    <Avatar player={opp} size="xs" />
                    <Text span fw={500} size="sm">
                      vs {opp?.name}
                    </Text>
                    <Text span c="dimmed" size="sm">
                      {m.scheduledAt ? dayLabel(m.scheduledAt) : 'to book'}
                    </Text>
                  </>
                )
                // Anyone can book an unbooked game; changing an existing booking is for admins.
                return isAdmin || (canBook && !m.scheduledAt) ? (
                  <UnstyledButton key={m.id} className={classes.upcoming} onClick={() => openBooking(m)}>
                    {content}
                  </UnstyledButton>
                ) : (
                  <span key={m.id} className={classes.upcoming}>
                    {content}
                  </span>
                )
              })}
            </Group>
          </div>
        ) : null}
      </section>

      <Card padding={0} className={classes.panel}>
        {entries.length ? (
          <Tabs defaultValue="record" classNames={{ root: classes.tabs, panel: classes.tabPanel }}>
            <Tabs.List px="sm">
              <Tabs.Tab value="record">Track record</Tabs.Tab>
              <Tabs.Tab value="h2h">Head to head · {rivals.length}</Tabs.Tab>
              <Tabs.Tab value="games">All games · {entries.length}</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="record" p="md">
              <Text size="sm" c="dimmed" mb="md">
                Skill rating after each game — everyone started at 1000.
              </Text>
              <RatingChart entries={entries} height={300} />
            </Tabs.Panel>
            <Tabs.Panel value="h2h" p="md">
              <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="sm" style={{ alignItems: 'start' }}>
                {rivals.map((r) => (
                  <RivalRow key={r.opponent.id} row={r} playerId={p.id} />
                ))}
              </SimpleGrid>
            </Tabs.Panel>
            <Tabs.Panel value="games">{gamesTable}</Tabs.Panel>
          </Tabs>
        ) : (
          <Box p="md">
            <Empty title="No games yet">Their track record, head-to-heads and game history appear after the first result.</Empty>
          </Box>
        )}
      </Card>
    </div>
  )
}
