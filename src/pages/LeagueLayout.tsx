import { Alert, Box, Button, Group, Loader, Modal, SegmentedControl, Stack, Text, TextInput, Title, Tooltip, UnstyledButton } from '@mantine/core'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { GameDialogsProvider } from '../components/GameDialogs'
import { IconArrowLeft, IconKey, IconLink, IconShield } from '../components/icons'
import { toast } from '../components/Toast'
import { Empty } from '../components/ui'
import { copy } from '../lib/clipboard'
import { LeagueProvider, useLeague, useLeagueLoader } from '../lib/league'
import { forgetLeague } from '../lib/storage'
import classes from './LeagueLayout.module.scss'

export default function LeagueLayout() {
  const { leagueId = '' } = useParams()
  const loader = useLeagueLoader(leagueId)
  const { state } = loader
  const notFound = state.status === 'error' && state.error.status === 404

  useEffect(() => {
    if (notFound) forgetLeague(leagueId)
  }, [notFound, leagueId])

  if (state.status === 'loading') {
    return (
      <div className={classes.centered}>
        <Loader color="gray" />
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <Box maw={420} mx="auto" px="md" py={80}>
        <Empty title={notFound ? 'League not found' : "Couldn't load this league"}>
          <Stack gap="md" align="center">
            <span>{notFound ? 'Double-check the link — it may have been deleted.' : state.error.message}</span>
            <Button component={Link} to="/" variant="light">
              Go home
            </Button>
          </Stack>
        </Empty>
      </Box>
    )
  }
  return (
    <LeagueProvider loader={loader}>
      <GameDialogsProvider>
        <LeagueShell />
      </GameDialogsProvider>
    </LeagueProvider>
  )
}

function LeagueShell() {
  const { league, viewer, isAdmin, signIn } = useLeague()
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [signInOpen, setSignInOpen] = useState(false)
  const invite = params.get('invite')

  useEffect(() => {
    document.title = `${league.name} · Pool League`
  }, [league.name])

  // Admin links carry the key in the #fragment (never sent to the server or logged).
  useEffect(() => {
    const match = location.hash.match(/key=([\w-]+)/)
    if (!match) return
    navigate({ pathname: location.pathname, search: location.search, hash: '' }, { replace: true })
    void signIn(match[1]).then((ok) => toast(ok ? "You're signed in as an admin on this device" : 'That admin link is no longer valid', ok ? 'success' : 'error'))
  }, [location.hash, location.pathname, location.search, navigate, signIn])

  const showSignIn = signInOpen || (!!invite && !isAdmin)

  const tabs = [
    { to: '', label: 'Overview', end: true },
    { to: 'games', label: 'Games' },
    { to: 'players', label: 'Players' },
    ...(isAdmin ? [{ to: 'admin', label: 'Admin' }] : []),
  ]
  const played = league.matches.filter((m) => m.result).length

  return (
    <div>
      <header className={classes.hero}>
        <div className={classes.inner}>
          <div className={classes.brand}>
            <Tooltip label="All leagues">
              <Link to="/" className={classes.home} aria-label="All leagues">
                <IconArrowLeft size={16} />
              </Link>
            </Tooltip>
            <div style={{ minWidth: 0 }}>
              <Title order={1} className={classes.title}>
                {league.name}
              </Title>
              <Text className={classes.subtitle}>
                🎱 8-ball · {league.players.length} players · {played} {played === 1 ? 'game' : 'games'} played
              </Text>
            </div>
          </div>
          <nav className={classes.tabs} aria-label="League sections">
            {tabs.map((t) => (
              <NavLink key={t.label} to={t.to} end={t.end} className={classes.tab}>
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className={classes.actions}>
            <UnstyledButton
              className={classes.pill}
              aria-label="Share league link"
              onClick={() => copy(`${window.location.origin}/l/${league.id}`, 'League link copied — share away!')}
            >
              <IconLink size={16} /> <span className={classes.pillLabel}>Share</span>
            </UnstyledButton>
            {isAdmin ? (
              <Tooltip label={`Signed in as ${viewer?.name}`}>
                <span className={`${classes.pill} ${classes.adminPill}`}>
                  <IconShield size={16} /> <span className={classes.pillLabel}>Admin</span>
                </span>
              </Tooltip>
            ) : (
              <Tooltip label="Only needed to manage the league — everyone can view it without signing in">
                <UnstyledButton className={classes.pill} onClick={() => setSignInOpen(true)}>
                  <IconKey size={16} />
                  <span>
                    Admin<span className={classes.pillLabel}> sign-in</span>
                  </span>
                </UnstyledButton>
              </Tooltip>
            )}
          </div>
        </div>
      </header>
      <main className={classes.main}>
        <Outlet />
      </main>
      <AdminSignInModal
        opened={showSignIn}
        initialCode={invite ?? ''}
        onClose={() => {
          setSignInOpen(false)
          if (invite) {
            params.delete('invite')
            setParams(params, { replace: true })
          }
        }}
      />
    </div>
  )
}

function AdminSignInModal({ opened, onClose, initialCode }: { opened: boolean; onClose: () => void; initialCode: string }) {
  const { run, signIn } = useLeague()
  const [mode, setMode] = useState<'invite' | 'key'>('invite')
  const [code, setCode] = useState(initialCode)
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastInitial, setLastInitial] = useState(initialCode)

  // An invite link arriving later (e.g. pasted into the same tab) pre-fills the code.
  if (initialCode !== lastInitial) {
    setLastInitial(initialCode)
    if (initialCode) {
      setCode(initialCode)
      setMode('invite')
    }
  }

  const valid = mode === 'invite' ? !!(code.trim() && name.trim()) : !!key.trim()

  async function submit() {
    if (!valid) return
    setBusy(true)
    if (mode === 'invite') {
      const res = await run({ action: 'redeemInvite', code, name }, `Welcome aboard, ${name.trim()}! You're now an admin.`)
      if (res) onClose()
    } else {
      // Accept either the raw key or a full admin link.
      const token = key.match(/key=([\w-]+)/)?.[1] ?? key.trim()
      const ok = await signIn(token)
      toast(ok ? "You're signed in as an admin" : "That key didn't work", ok ? 'success' : 'error')
      if (ok) onClose()
    }
    setBusy(false)
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div>
          <Text fw={600} size="lg">
            Admin sign-in
          </Text>
          <Text size="sm" c="dimmed">
            Admins add players, book games and enter results.
          </Text>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Stack gap="md">
          <Alert variant="light" color="gray" radius="md" p="sm">
            <Text size="sm">
              <strong>Just playing?</strong> You don't need to sign in — everyone with the league link can see everything, and you can set your play times on
              the Players tab.
            </Text>
          </Alert>
          <SegmentedControl
            fullWidth
            value={mode}
            onChange={(v) => setMode(v as 'invite' | 'key')}
            data={[
              { value: 'invite', label: 'I have an invite code' },
              { value: 'key', label: 'I have my admin link' },
            ]}
          />
          {mode === 'invite' ? (
            <>
              <TextInput
                label="Invite code"
                description="Ask an existing admin to create one on the Admin tab."
                placeholder="ABCD-1234"
                value={code}
                onChange={(e) => setCode(e.currentTarget.value)}
                autoCapitalize="characters"
                styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', letterSpacing: '0.15em', textTransform: 'uppercase' } }}
                data-autofocus
              />
              <TextInput label="Your name" placeholder="e.g. Sam" maxLength={40} value={name} onChange={(e) => setName(e.currentTarget.value)} />
            </>
          ) : (
            <TextInput
              label="Admin link or key"
              description="Your personal admin link is on the Admin tab of any device you're already signed in on."
              placeholder="https://…#key=…"
              value={key}
              onChange={(e) => setKey(e.currentTarget.value)}
              data-autofocus
            />
          )}
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" color="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!valid}>
              {mode === 'invite' ? 'Join as admin' : 'Sign in'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
