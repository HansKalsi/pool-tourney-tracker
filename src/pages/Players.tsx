import { Button, Group, SimpleGrid, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { Link } from 'react-router'
import { AvailabilityGrid } from '../components/Availability'
import { Avatar } from '../components/Avatar'
import { IconUserPlus } from '../components/icons'
import { Empty, SectionHeader } from '../components/ui'
import { plural } from '../lib/format'
import { useLeague } from '../lib/league'
import classes from './Players.module.scss'

export default function Players() {
  const { league, stats, isAdmin, run } = useLeague()
  const [names, setNames] = useState('')
  const [saving, setSaving] = useState(false)
  // Alphabetical on purpose — this page is a directory, not a ranking.
  const sorted = [...stats].sort((a, b) => a.player.name.localeCompare(b.player.name))

  async function add() {
    const list = names.split(/[,\n]/).map((n) => n.trim()).filter(Boolean)
    if (!list.length) return
    setSaving(true)
    const res = await run({ action: 'addPlayers', names: list }, list.length === 1 ? `${list[0]} added` : `${list.length} players added`)
    setSaving(false)
    if (res) setNames('')
  }

  return (
    <div className={classes.layout}>
      <section className={classes.col}>
        <SectionHeader title="Players" subtitle={`${sorted.length} in the league · tap someone to see their record`} />
        {isAdmin ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void add()
            }}
          >
            <Group gap="xs" wrap="nowrap" align="flex-start">
              <TextInput
                style={{ flex: 1 }}
                value={names}
                onChange={(e) => setNames(e.currentTarget.value)}
                placeholder="Add players — separate names with commas"
                aria-label="New player names"
              />
              <Button type="submit" loading={saving} disabled={!names.trim()} leftSection={<IconUserPlus size={16} />}>
                Add
              </Button>
            </Group>
          </form>
        ) : null}

        {sorted.length ? (
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
            {sorted.map((s) => (
              <Link key={s.player.id} to={`/l/${league.id}/players/${s.player.id}`} className={classes.card}>
                <Avatar player={s.player} size="md" />
                <div style={{ minWidth: 0 }}>
                  <Text fw={600} truncate>
                    {s.player.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {s.played ? `${s.rating} rating · ${plural(s.played, 'game')}` : 'Yet to play · 1000 rating'}
                  </Text>
                </div>
              </Link>
            ))}
          </SimpleGrid>
        ) : (
          <Empty icon={<IconUserPlus size={28} />} title="No players yet" />
        )}
      </section>

      {sorted.length ? (
        <section className={classes.col}>
          <SectionHeader title="When can you play?" subtitle="Tick the office slots that usually suit you — anyone can update their own row." />
          <AvailabilityGrid />
        </section>
      ) : null}
    </div>
  )
}
