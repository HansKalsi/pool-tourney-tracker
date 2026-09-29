import { Anchor, Button, Card, Group, SimpleGrid, Title } from '@mantine/core'
import { useState } from 'react'
import { Link } from 'react-router'
import { useGameDialogs } from '../components/GameDialogs'
import { IconCalendarPlus, IconClipboardPen, IconSparkles, IconUserPlus } from '../components/icons'
import { LatestResults } from '../components/LatestResults'
import { NextUp } from '../components/NextUp'
import { Highlights, Podium } from '../components/Podium'
import { StillToPlayPanel } from '../components/StillToPlay'
import { Empty } from '../components/ui'
import { useLeague } from '../lib/league'
import { playedMatches, stillToPlay } from '../lib/stats'
import classes from './Overview.module.scss'

export function useFixtures() {
  const { league } = useLeague()
  const pending = league.matches.filter((m) => !m.result)
  const booked = pending.filter((m) => m.scheduledAt).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))
  const unbooked = pending.filter((m) => !m.scheduledAt)
  const played = playedMatches(league).reverse()
  return { booked, unbooked, played }
}

export function AdminQuickActions({ size = 'sm' }: { size?: 'xs' | 'sm' }) {
  const { isAdmin, league, run } = useLeague()
  const { openBooking, openResult } = useGameDialogs()
  const [filling, setFilling] = useState(false)
  if (!isAdmin) return null
  const canPlay = league.players.length >= 2

  async function fill() {
    setFilling(true)
    await run({ action: 'generateFixtures', scope: 'unplayed' }, 'Matchups created — everyone plays everyone')
    setFilling(false)
  }

  return (
    <Group gap="xs">
      <Button size={size} leftSection={<IconClipboardPen size={16} />} onClick={() => openResult()} disabled={!canPlay}>
        Log a result
      </Button>
      <Button size={size} variant="default" leftSection={<IconCalendarPlus size={16} />} onClick={() => openBooking()} disabled={!canPlay}>
        Book a game
      </Button>
      <Button
        size={size}
        variant="subtle"
        color="gray"
        leftSection={<IconSparkles size={16} />}
        onClick={fill}
        loading={filling}
        disabled={!canPlay}
        title="Creates a game for every pair of players who haven't been matched yet"
      >
        Fill in matchups
      </Button>
    </Group>
  )
}

function Kpi({ label, value, extra }: { label: string; value: string | number; extra?: string }) {
  return (
    <div className={classes.kpi}>
      <div className={classes.kpiLabel}>{label}</div>
      <div className={classes.kpiValue}>
        {value}
        {extra ? <small>{extra}</small> : null}
      </div>
    </div>
  )
}

function ResultsPanel() {
  const { league } = useLeague()
  const count = league.matches.filter((m) => m.result).length
  return (
    <Card padding="md">
      <div className={classes.panelTitle}>
        <Title order={2} fz="md" fw={650}>
          Latest results
        </Title>
        {count > 6 ? (
          <Anchor component={Link} to="games?view=played" size="xs" fw={500}>
            All {count}
          </Anchor>
        ) : null}
      </div>
      <LatestResults limit={6} />
    </Card>
  )
}

/** The league at a glance — what anyone opening the link sees first. */
export default function Overview() {
  const { league, isAdmin } = useLeague()
  const { booked, played } = useFixtures()
  const { playedPairs, totalPairs } = stillToPlay(league)

  if (league.players.length < 2) {
    return (
      <Empty icon={<IconUserPlus size={28} />} title="Add some players to get started">
        {isAdmin ? (
          <Button component={Link} to="players" variant="light" mt="xs">
            Add players
          </Button>
        ) : (
          'The league admin hasn’t added players yet.'
        )}
      </Empty>
    )
  }

  const upcoming = booked.filter((m) => Date.parse(m.scheduledAt!) >= Date.now()).length

  return (
    <div className={classes.page}>
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <Kpi label="Games played" value={played.length} />
        <Kpi label="Games booked" value={upcoming} />
        <Kpi label="Pairings played" value={playedPairs} extra={`of ${totalPairs}`} />
        <Kpi label="Players" value={league.players.length} />
      </SimpleGrid>

      <div className={classes.layout}>
        <aside className={`${classes.col} ${classes.left}`}>
          <Podium compact />
          <Highlights compact />
        </aside>

        <section className={`${classes.col} ${classes.center}`}>
          <NextUp />
          <ResultsPanel />
        </section>

        <aside className={classes.col}>
          <StillToPlayPanel />
          <div className={classes.rightExtras}>
            <Podium compact />
            <Highlights compact />
          </div>
        </aside>
      </div>
    </div>
  )
}
