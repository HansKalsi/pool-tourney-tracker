import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useHandoff } from './Handoff'

export interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  danger?: boolean
  /** Adds a text field; its value is passed to onConfirm. */
  input?: { label: string; initial?: string; placeholder?: string; maxLength?: number; mustEqual?: string }
  /** Runs while the confirm button shows a spinner. Return false to keep the dialog open (e.g. on error). */
  onConfirm: (value: string) => unknown | Promise<unknown>
}

const ConfirmContext = createContext<(opts: ConfirmOptions, onClosed?: () => void) => void>(() => {})

/** In-app replacement for window.confirm / window.prompt, with a loading state. */
export function useConfirm() {
  const show = useContext(ConfirmContext)
  const handoff = useHandoff()
  // Opened from inside a popover: hide the popover until the dialog has closed.
  return useMemo(
    () =>
      handoff
        ? (opts: ConfirmOptions) => {
            handoff.suspend()
            show(opts, handoff.resume)
          }
        : (opts: ConfirmOptions) => show(opts),
    [show, handoff],
  )
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const onClosed = useRef<(() => void) | undefined>(undefined)

  const show = useCallback((o: ConfirmOptions, closed?: () => void) => {
    onClosed.current = closed
    setValue(o.input?.initial ?? '')
    setBusy(false)
    setOpts(o)
    setOpen(true)
  }, [])

  const close = () => !busy && setOpen(false)
  const input = opts?.input
  const valid = !input || (input.mustEqual !== undefined ? value.trim() === input.mustEqual : value.trim().length > 0)

  async function submit() {
    if (!opts || !valid) return
    setBusy(true)
    const result = await opts.onConfirm(value.trim())
    setBusy(false)
    if (result !== false) setOpen(false)
  }

  return (
    <ConfirmContext.Provider value={show}>
      {children}
      <Modal
        opened={open}
        onClose={close}
        onExitTransitionEnd={() => {
          const cb = onClosed.current
          onClosed.current = undefined
          cb?.()
        }}
        title={<Text fw={600} size="lg">{opts?.title}</Text>}
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <Stack gap="md">
            {opts?.message ? (
              <Text size="sm" c="dimmed">
                {opts.message}
              </Text>
            ) : null}
            {input ? (
              <TextInput
                label={input.label}
                value={value}
                maxLength={input.maxLength}
                placeholder={input.placeholder}
                onChange={(e) => setValue(e.currentTarget.value)}
                autoComplete="off"
                data-autofocus
              />
            ) : null}
            <Group justify="flex-end" gap="xs" mt="xs">
              <Button variant="subtle" color="gray" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" color={opts?.danger ? 'red' : undefined} loading={busy} disabled={!valid}>
                {opts?.confirmLabel ?? 'Confirm'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </ConfirmContext.Provider>
  )
}
