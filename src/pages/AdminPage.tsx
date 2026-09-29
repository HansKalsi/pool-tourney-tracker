import { Button, Card, CopyButton, Group, Modal, Stack, Text, TextInput, ThemeIcon } from '@mantine/core'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ActivityLog } from '../components/ActivityLog'
import { useConfirm } from '../components/Confirm'
import { IconCheck, IconCopy, IconKey, IconLogout, IconPlus, IconShield, IconTrash } from '../components/icons'
import { toast } from '../components/Toast'
import { SectionHeader } from '../components/ui'
import { copy } from '../lib/clipboard'
import { inlineDay, shortDate } from '../lib/format'
import { useLeague } from '../lib/league'
import { forgetLeague } from '../lib/storage'
import classes from './AdminPage.module.scss'

export default function AdminPage() {
  const { league, viewer, invites = [], token, run, signOut } = useLeague()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [name, setName] = useState(league.name)
  const [renaming, setRenaming] = useState(false)
  const [newCode, setNewCode] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  if (!viewer) return <Navigate to={`/l/${league.id}`} replace />

  const leagueUrl = `${window.location.origin}/l/${league.id}`
  const adminLink = `${leagueUrl}#key=${token}`
  const inviteLink = (code: string) => `${leagueUrl}?invite=${code}`
  const nameChanged = !!name.trim() && name.trim() !== league.name

  async function createInvite() {
    setInviting(true)
    const res = await run({ action: 'createInvite' })
    setInviting(false)
    if (res?.code) setNewCode(res.code)
  }

  async function rename() {
    if (!nameChanged) return
    setRenaming(true)
    await run({ action: 'renameLeague', name }, 'League renamed')
    setRenaming(false)
  }

  async function revoke(inviteId: string) {
    setRevoking(inviteId)
    await run({ action: 'revokeInvite', inviteId }, 'Invite revoked')
    setRevoking(null)
  }

  const deleteLeague = () =>
    confirm({
      title: 'Delete this league?',
      message: `This permanently deletes "${league.name}", every player and every result. It can't be undone.`,
      confirmLabel: 'Delete league',
      danger: true,
      input: { label: 'Type the league name to confirm', placeholder: league.name, mustEqual: league.name },
      onConfirm: async () => {
        const res = await run({ action: 'deleteLeague' })
        if (!res?.deleted) return false
        forgetLeague(league.id)
        toast('League deleted')
        navigate('/')
      },
    })

  const removeAdmin = (adminId: string, adminName: string) => {
    const self = adminId === viewer.adminId
    confirm({
      title: self ? 'Stop being an admin?' : `Remove ${adminName} as an admin?`,
      message: self ? "You'll still be able to view the league, but not change anything." : `${adminName} will no longer be able to make changes.`,
      confirmLabel: self ? 'Leave' : 'Remove',
      danger: true,
      onConfirm: async () => !!(await run({ action: 'removeAdmin', adminId }, self ? "You're no longer an admin" : `${adminName} removed`)),
    })
  }

  return (
    <div className={classes.layout}>
      <div className={classes.col}>
        <section>
          <SectionHeader title="You" subtitle={`Signed in as ${viewer.name}${viewer.isOwner ? ' (league creator)' : ''}`} />
          <Card padding="md">
            <Stack gap="sm">
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <IconKey size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 3 }} />
                <Text size="sm">
                  This is your personal admin link. Open it on your phone or another browser to sign in there too. Keep it to yourself — anyone with it can edit
                  the league.
                </Text>
              </Group>
              <Group gap="xs" wrap="nowrap">
                <TextInput
                  style={{ flex: 1 }}
                  readOnly
                  value={adminLink}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Your admin link"
                  styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12 } }}
                />
                <CopyButton value={adminLink}>
                  {({ copied, copy: doCopy }) => (
                    <Button variant="default" onClick={doCopy} leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}>
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
              <div>
                <Button
                  variant="subtle"
                  color="gray"
                  size="compact-sm"
                  leftSection={<IconLogout size={16} />}
                  onClick={() =>
                    confirm({
                      title: 'Sign out on this device?',
                      message: "You'll need your admin link to sign back in, so copy it first if you haven't saved it.",
                      confirmLabel: 'Sign out',
                      onConfirm: () => {
                        signOut()
                        navigate(`/l/${league.id}`)
                      },
                    })
                  }
                >
                  Sign out on this device
                </Button>
              </div>
            </Stack>
          </Card>
        </section>

        <section>
          <SectionHeader title="League name" />
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void rename()
            }}
          >
            <Group gap="xs" wrap="nowrap">
              <TextInput style={{ flex: 1 }} value={name} maxLength={60} onChange={(e) => setName(e.currentTarget.value)} aria-label="League name" />
              <Button type="submit" variant="default" disabled={!nameChanged} loading={renaming}>
                Save
              </Button>
            </Group>
          </form>
        </section>

        <section>
          <SectionHeader
            title="Admins"
            subtitle="Admins can add players, book games and enter results."
            action={
              <Button size="compact-md" leftSection={<IconPlus size={16} />} onClick={createInvite} loading={inviting}>
                Invite admin
              </Button>
            }
          />
          <Card padding={0}>
            {league.admins.map((a, i) => (
              <Group key={a.id} p="md" gap="sm" wrap="nowrap" style={i ? { borderTop: '1px solid var(--app-border)' } : undefined}>
                <ThemeIcon variant="light" radius="xl" size="md">
                  <IconShield size={16} />
                </ThemeIcon>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={500} truncate>
                    {a.name}{' '}
                    {a.id === viewer.adminId ? (
                      <Text span c="dimmed">
                        (you)
                      </Text>
                    ) : null}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {a.isOwner ? 'Creator' : `Admin since ${shortDate(a.createdAt)}`}
                  </Text>
                </div>
                {!a.isOwner && (viewer.isOwner || a.id === viewer.adminId) ? (
                  <Button variant="subtle" color="gray" size="compact-sm" onClick={() => removeAdmin(a.id, a.name)}>
                    {a.id === viewer.adminId ? 'Leave' : 'Remove'}
                  </Button>
                ) : null}
              </Group>
            ))}
          </Card>
          {invites.length ? (
            <Stack gap={6} mt="md">
              <Text size="sm" fw={500} c="dimmed">
                Open invites
              </Text>
              {invites.map((i) => (
                <Group
                  key={i.id}
                  justify="space-between"
                  gap="sm"
                  px="sm"
                  py={6}
                  style={{ background: 'var(--app-subtle-bg)', borderRadius: 'var(--mantine-radius-md)' }}
                >
                  <Text size="sm">
                    Created by {i.createdBy} · expires {inlineDay(i.expiresAt)}
                  </Text>
                  <Button variant="subtle" color="gray" size="compact-sm" onClick={() => revoke(i.id)} loading={revoking === i.id}>
                    Revoke
                  </Button>
                </Group>
              ))}
            </Stack>
          ) : null}
        </section>

        {viewer.isOwner ? (
          <section>
            <SectionHeader title="Danger zone" />
            <Button variant="light" color="red" leftSection={<IconTrash size={16} />} onClick={deleteLeague}>
              Delete league
            </Button>
          </section>
        ) : null}
      </div>

      <div className={classes.log}>
        <ActivityLog />
      </div>

      <Modal
        opened={!!newCode}
        onClose={() => setNewCode(null)}
        title={
          <div>
            <Text fw={600} size="lg">
              Invite code ready
            </Text>
            <Text size="sm" c="dimmed">
              It works once and expires in 7 days.
            </Text>
          </div>
        }
      >
        <Stack gap="md">
          <Text
            ta="center"
            py="lg"
            ff="monospace"
            fz={30}
            fw={700}
            style={{ letterSpacing: '0.2em', background: 'var(--app-subtle-bg)', borderRadius: 'var(--mantine-radius-lg)' }}
          >
            {newCode}
          </Text>
          <Text size="sm" c="dimmed">
            They can open the invite link directly, or tap <strong>Admin</strong> on the league page and enter the code. Only a scrambled copy is stored, so
            this is the only time it's shown.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => copy(newCode!, 'Code copied')}>
              Copy code
            </Button>
            <Button onClick={() => copy(inviteLink(newCode!), 'Invite link copied')}>Copy invite link</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  )
}
