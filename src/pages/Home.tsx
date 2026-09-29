import { Button, Card, Checkbox, Stack, Text, Textarea, TextInput, Title } from '@mantine/core'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { IconChevronRight, IconShield } from '../components/icons'
import { toast } from '../components/Toast'
import { sendAction } from '../lib/api'
import { inlineDay } from '../lib/format'
import { getRecent, getToken, rememberLeague, setToken } from '../lib/storage'
import classes from './Home.module.scss'

export default function Home() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [players, setPlayers] = useState('')
  const [playing, setPlaying] = useState(true)
  const [busy, setBusy] = useState(false)
  const [recent] = useState(getRecent)

  async function create() {
    if (!name.trim() || !adminName.trim()) return
    setBusy(true)
    try {
      const list = players.split(/[,\n]/).map((p) => p.trim()).filter(Boolean)
      // The creator is added as a player too unless they unticked "I'm playing too" (or already listed themselves).
      const me = adminName.trim()
      if (playing && !list.some((p) => p.toLowerCase() === me.toLowerCase())) list.unshift(me)
      const res = await sendAction({ action: 'createLeague', name, adminName, players: list }, null)
      const id = res.league!.id
      setToken(id, res.token!)
      rememberLeague(id, res.league!.name)
      toast("League created — you're the admin. Grab your admin link from the Admin tab.")
      navigate(`/l/${id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className={classes.hero}>
        <div className={classes.ball}>
          <span>8</span>
        </div>
        <Title order={1} className={classes.title}>
          Pool League
        </Title>
        <Text className={classes.lead}>A friendly 8-ball league for you and your colleagues. Book games, log results, and see who's on a roll.</Text>
      </div>

      <Stack className={classes.content} gap="lg">
        {recent.length ? (
          <Card padding="xs">
            <Text size="sm" fw={600} c="dimmed" px="sm" pt={6} pb={4}>
              Your leagues
            </Text>
            {recent.map((l) => (
              <Link key={l.id} to={`/l/${l.id}`} className={classes.recent}>
                <span style={{ fontSize: 20 }}>🎱</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={500} truncate>
                    {l.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Opened {inlineDay(l.visitedAt)}
                  </Text>
                </div>
                {getToken(l.id) ? <IconShield size={16} color="var(--mantine-color-felt-text)" aria-label="You're an admin" /> : null}
                <IconChevronRight size={16} color="var(--mantine-color-dimmed)" />
              </Link>
            ))}
          </Card>
        ) : null}

        <Card padding="xl" shadow="sm">
          <Title order={2} fz="xl" fw={650}>
            Start a league
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            No sign-up. You'll be the admin, and anyone with the link can follow along.
          </Text>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void create()
            }}
          >
            <Stack gap="md" mt="lg">
              <TextInput label="League name" required maxLength={60} value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="Office Pool League" />
              <div>
                <TextInput
                  label="Your name"
                  description="You'll be the league admin — the one who can add players, book games and enter results."
                  required
                  maxLength={40}
                  value={adminName}
                  onChange={(e) => setAdminName(e.currentTarget.value)}
                  placeholder="Sam"
                />
                <Checkbox
                  mt="sm"
                  label="I'm playing too — add me as a player"
                  checked={playing}
                  onChange={(e) => setPlaying(e.currentTarget.checked)}
                />
              </div>
              <Textarea
                label={playing ? 'Other players' : 'Players'}
                description={
                  playing && adminName.trim()
                    ? `${adminName.trim()} is already included. Add everyone else — comma separated or one per line. You can add more later.`
                    : 'Comma separated or one per line. You can add more later.'
                }
                autosize
                minRows={3}
                value={players}
                onChange={(e) => setPlayers(e.currentTarget.value)}
                placeholder="Alex, Priya, Jordan"
              />
              <Button type="submit" size="md" fullWidth loading={busy} disabled={!name.trim() || !adminName.trim()}>
                Create league
              </Button>
            </Stack>
          </form>
        </Card>

        <Text size="sm" c="dimmed" ta="center">
          Got a league link from a colleague? Just open it — no account needed.
        </Text>
      </Stack>
    </div>
  )
}
