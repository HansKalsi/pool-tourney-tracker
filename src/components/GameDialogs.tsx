import { Autocomplete, Button, Group, Modal, Radio, Select, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import { DateTimePicker } from '@mantine/dates'
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Match, ResultMethod } from '../../shared/types'
import { fromPickerValue, toPickerValue } from '../lib/format'
import { useLeague } from '../lib/league'
import { pointsInPlay } from '../lib/stats'
import { sharedSlots, SuggestedTimes } from './Availability'
import { Avatar } from './Avatar'
import { useHandoff } from './Handoff'
import classes from './GameDialogs.module.scss'
import { IconTrophy } from './icons'

type DialogState = { kind: 'book' | 'result'; match?: Match; preset?: [string, string]; at?: Date; key: number } | null

interface GameDialogsApi {
  /** `at` pre-fills the time (e.g. from a calendar slot). */
  openBooking: (match?: Match, preset?: [string, string], at?: Date) => void
  openResult: (match?: Match, preset?: [string, string]) => void
}

type OpenFns = {
  openBooking: (match?: Match, preset?: [string, string], at?: Date, onClosed?: () => void) => void
  openResult: (match?: Match, preset?: [string, string], onClosed?: () => void) => void
}

const GameDialogsContext = createContext<OpenFns>({ openBooking: () => {}, openResult: () => {} })

/** Opening a dialog from inside a popover hides the popover until the dialog has closed. */
export function useGameDialogs(): GameDialogsApi {
  const api = useContext(GameDialogsContext)
  const handoff = useHandoff()
  return useMemo(() => {
    if (!handoff) return api
    return {
      openBooking: (match, preset, at) => {
        handoff.suspend()
        api.openBooking(match, preset, at, handoff.resume)
      },
      openResult: (match, preset) => {
        handoff.suspend()
        api.openResult(match, preset, handoff.resume)
      },
    }
  }, [api, handoff])
}

export function GameDialogsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(null)
  const [open, setOpen] = useState(false)
  const onClosed = useRef<(() => void) | undefined>(undefined)
  const api = useMemo<OpenFns>(
    () => ({
      openBooking: (match, preset, at, closed) => {
        onClosed.current = closed
        setState({ kind: 'book', match, preset, at, key: Date.now() })
        setOpen(true)
      },
      openResult: (match, preset, closed) => {
        onClosed.current = closed
        setState({ kind: 'result', match, preset, key: Date.now() })
        setOpen(true)
      },
    }),
    [],
  )
  const afterClose = () => {
    const cb = onClosed.current
    onClosed.current = undefined
    cb?.()
  }
  const close = () => setOpen(false)
  const title = state?.kind === 'book' ? (state.match?.scheduledAt ? 'Change booking' : 'Book a game') : state?.match?.result ? 'Edit result' : 'Enter result'

  return (
    <GameDialogsContext.Provider value={api}>
      {children}
      <Modal opened={open} onClose={close} onExitTransitionEnd={afterClose} title={<Text fw={600} size="lg">{title}</Text>} size="md">
        {/* `key` remounts the form so each open starts from fresh defaults. */}
        {state?.kind === 'book' ? <BookingForm key={state.key} match={state.match} preset={state.preset} at={state.at} onClose={close} /> : null}
        {state?.kind === 'result' ? <ResultForm key={state.key} match={state.match} preset={state.preset} onClose={close} /> : null}
      </Modal>
    </GameDialogsContext.Provider>
  )
}

function nextHour() {
  const d = new Date()
  d.setHours(d.getHours() + 1, 0, 0, 0)
  return d
}

function PlayerPicker({ value, onChange }: { value: [string, string]; onChange: (v: [string, string]) => void }) {
  const { league } = useLeague()
  const players = [...league.players].sort((a, b) => a.name.localeCompare(b.name))
  const data = (other: string) => players.map((p) => ({ value: p.id, label: p.name, disabled: p.id === other }))
  return (
    <SimpleGrid cols={2} spacing="sm">
      <Select label="Player" placeholder="Choose…" data={data(value[1])} value={value[0] || null} onChange={(v) => onChange([v ?? '', value[1]])} searchable />
      <Select label="Opponent" placeholder="Choose…" data={data(value[0])} value={value[1] || null} onChange={(v) => onChange([value[0], v ?? ''])} searchable />
    </SimpleGrid>
  )
}

function FixedPlayers({ ids }: { ids: [string, string] }) {
  const { player } = useLeague()
  return (
    <div className={classes.fixedPlayers}>
      {ids.map((id, i) => (
        <div key={id} className={classes.fixedSide} data-align={i === 1 ? 'right' : 'left'}>
          <Avatar player={player(id)} size="sm" />
          <Text truncate fw={500}>
            {player(id)?.name}
          </Text>
        </div>
      ))}
    </div>
  )
}

function BookingForm({ match, preset, at, onClose }: { match?: Match; preset?: [string, string]; at?: Date; onClose: () => void }) {
  const { league, run } = useLeague()
  const [pair, setPair] = useState<[string, string]>(match?.playerIds ?? preset ?? ['', ''])
  // Start on the soonest slot both players like, if there is one.
  const [when, setWhen] = useState<string | null>(() =>
    toPickerValue(match?.scheduledAt ?? at ?? (match ? sharedSlots(league, match.playerIds, match.id)[0]?.date : undefined) ?? nextHour()),
  )
  const lastLocation = [...league.matches].reverse().find((m) => m.location)?.location ?? ''
  const [location, setLocation] = useState(match?.location ?? lastLocation)
  const [saving, setSaving] = useState(false)
  const knownLocations = [...new Set(league.matches.map((m) => m.location).filter(Boolean))] as string[]
  const valid = !!(pair[0] && pair[1] && pair[0] !== pair[1] && when)

  async function save() {
    if (!valid) return
    setSaving(true)
    const scheduledAt = fromPickerValue(when!)
    const res = match
      ? await run({ action: 'updateMatch', matchId: match.id, scheduledAt, location }, 'Game booked')
      : await run({ action: 'createMatch', playerIds: pair, scheduledAt, location, result: null }, 'Game booked')
    setSaving(false)
    if (res) onClose()
  }

  async function unbook() {
    if (!match) return
    setSaving(true)
    const res = await run({ action: 'updateMatch', matchId: match.id, scheduledAt: null, location: null }, 'Booking cleared')
    setSaving(false)
    if (res) onClose()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Stack gap="md">
        {match ? <FixedPlayers ids={match.playerIds} /> : <PlayerPicker value={pair} onChange={setPair} />}
        <SuggestedTimes pair={pair} matchId={match?.id} selected={when} onPick={(d) => setWhen(toPickerValue(d))} />
        <DateTimePicker
          label="When"
          value={when}
          onChange={setWhen}
          valueFormat="ddd D MMM YYYY, HH:mm"
          firstDayOfWeek={1}
          required
          dropdownType="modal"
          modalProps={{ size: 'auto' }}
        />
        <Autocomplete
          label="Where"
          description="Optional — e.g. “Office table”."
          placeholder="Office table"
          value={location}
          onChange={setLocation}
          data={knownLocations}
          maxLength={80}
        />
        <Group justify="flex-end" gap="xs" mt="xs">
          {match?.scheduledAt ? (
            <Button variant="subtle" color="gray" mr="auto" onClick={unbook} disabled={saving}>
              Clear booking
            </Button>
          ) : null}
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!valid}>
            Save
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

function ResultForm({ match, preset, onClose }: { match?: Match; preset?: [string, string]; onClose: () => void }) {
  const { run, player, ratings } = useLeague()
  const [pair, setPair] = useState<[string, string]>(match?.playerIds ?? preset ?? ['', ''])
  const [winnerId, setWinnerId] = useState(match?.result?.winnerId ?? '')
  const [method, setMethod] = useState<ResultMethod>(match?.result?.method ?? 'standard')
  const [playedAt, setPlayedAt] = useState<string | null>(() =>
    toPickerValue(match?.result?.playedAt ?? (match?.scheduledAt && Date.parse(match.scheduledAt) < Date.now() ? match.scheduledAt : new Date())),
  )
  const [saving, setSaving] = useState(false)

  const pairReady = !!(pair[0] && pair[1] && pair[0] !== pair[1])
  const valid = pairReady && pair.includes(winnerId) && !!playedAt
  const loserName = winnerId ? player(pair.find((id) => id !== winnerId) ?? '')?.name : undefined
  // Skip for edits: current ratings already include this game's result.
  const stakes = pairReady && !match?.result ? pointsInPlay(ratings, pair[0], pair[1]) : null

  async function save() {
    if (!valid) return
    setSaving(true)
    const result = { winnerId, method, playedAt: fromPickerValue(playedAt!) }
    const res = match
      ? await run({ action: 'setResult', matchId: match.id, result }, 'Result saved')
      : await run({ action: 'createMatch', playerIds: pair, scheduledAt: null, location: null, result }, 'Result saved')
    setSaving(false)
    if (res) onClose()
  }

  async function clear() {
    if (!match) return
    setSaving(true)
    const res = await run({ action: 'setResult', matchId: match.id, result: null }, 'Result cleared')
    setSaving(false)
    if (res) onClose()
  }

  return (
    <Stack gap="lg">
      {!match ? (
        <PlayerPicker
          value={pair}
          onChange={(p) => {
            setPair(p)
            if (!p.includes(winnerId)) setWinnerId('')
          }}
        />
      ) : null}

      <div>
        <Text size="sm" fw={500} mb={6}>
          Who won?
        </Text>
        <div className={classes.winnerGrid} role="radiogroup" aria-label="Winner">
          {pair.map((id, i) => {
            const selected = !!id && winnerId === id
            return (
              <UnstyledButton
                key={i}
                className={classes.winner}
                data-selected={selected || undefined}
                disabled={!pairReady}
                onClick={() => setWinnerId(id)}
                role="radio"
                aria-checked={selected}
              >
                {selected ? <IconTrophy size={16} className={classes.trophy} /> : null}
                <Avatar player={player(id)} size="lg" />
                <span className={classes.winnerName}>{player(id)?.name ?? (i === 0 ? 'Player' : 'Opponent')}</span>
                {stakes ? <span className={classes.points}>+{stakes[id]} points</span> : null}
              </UnstyledButton>
            )
          })}
        </div>
      </div>

      <Radio.Group label="How?" value={method} onChange={(v) => setMethod(v as ResultMethod)}>
        <Stack gap="xs" mt={6}>
          <Radio.Card value="standard" p="sm" radius="lg">
            <Group wrap="nowrap" align="flex-start" gap="sm">
              <Radio.Indicator mt={2} />
              <div>
                <Text size="sm" fw={500}>
                  Won the game
                </Text>
                <Text size="xs" c="dimmed">
                  Cleared their balls and potted the black.
                </Text>
              </div>
            </Group>
          </Radio.Card>
          <Radio.Card value="default" p="sm" radius="lg">
            <Group wrap="nowrap" align="flex-start" gap="sm">
              <Radio.Indicator mt={2} />
              <div>
                <Text size="sm" fw={500}>
                  Won by default
                </Text>
                <Text size="xs" c="dimmed">
                  {loserName ?? 'The opponent'} potted the black early or fouled on it. Counts as a normal win.
                </Text>
              </div>
            </Group>
          </Radio.Card>
        </Stack>
      </Radio.Group>

      <DateTimePicker label="Played" value={playedAt} onChange={setPlayedAt} valueFormat="ddd D MMM YYYY, HH:mm" firstDayOfWeek={1} dropdownType="modal" modalProps={{ size: 'auto' }} />

      <Group justify="flex-end" gap="xs">
        {match?.result ? (
          <Button variant="subtle" color="gray" mr="auto" onClick={clear} disabled={saving}>
            Clear result
          </Button>
        ) : null}
        <Button variant="subtle" color="gray" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} loading={saving} disabled={!valid}>
          Save result
        </Button>
      </Group>
    </Stack>
  )
}
