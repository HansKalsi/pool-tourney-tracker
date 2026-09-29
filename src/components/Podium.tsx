import { Card, Group, SimpleGrid, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core'
import { Link } from 'react-router'
import { useLeague } from '../lib/league'
import { highlights, podium, type PodiumStep } from '../lib/stats'
import { Avatar } from './Avatar'
import { IconFlame, IconMedal, IconRepeat, IconSwords, IconTrophy } from './icons'
import classes from './Podium.module.scss'
import { Empty } from './ui'

const LABEL = { 1: '1st', 2: '2nd', 3: '3rd' } as const

function Step({ step }: { step: PodiumStep }) {
  const { league } = useLeague()
  const shown = step.entries.slice(0, 3)
  const extra = step.entries.length - shown.length
  return (
    <div className={classes.step} data-place={step.place}>
      <div className={classes.avatars}>
        {shown.map((s) => (
          <Link key={s.player.id} to={`/l/${league.id}/players/${s.player.id}`} title={s.player.name} className={classes.avatarLink}>
            <Avatar player={s.player} size={step.place === 1 ? 'lg' : 'md'} />
          </Link>
        ))}
      </div>
      <div className={classes.names}>
        {shown.map((s) => s.player.name).join(', ')}
        {extra > 0 ? ` +${extra}` : ''}
      </div>
      <div className={classes.rating}>
        <strong>{step.entries[0].rating}</strong> rating
      </div>
      <div className={classes.block}>
        <span className={classes.medal}>
          <IconMedal size={16} />
          {LABEL[step.place]}
        </span>
      </div>
    </div>
  )
}

const RANKING_NOTE = 'Ranked by skill rating. Everyone starts at 1000 and a win captures points from your opponent — more for beating a stronger player.'

export function Podium({ compact = false }: { compact?: boolean }) {
  const { stats } = useLeague()
  const steps = podium(stats)
  return (
    <Card padding={compact ? 'md' : 'lg'} data-compact={compact || undefined}>
      <Group gap={8} mb="md" wrap="nowrap">
        <IconTrophy size={18} color="#f59e0b" />
        <Title order={2} fz={compact ? 'md' : 'lg'} fw={650}>
          Top of the table
        </Title>
        {compact ? (
          <Tooltip label={RANKING_NOTE} multiline maw={260}>
            <Text size="xs" c="dimmed" ml="auto" style={{ cursor: 'help' }}>
              How?
            </Text>
          </Tooltip>
        ) : null}
      </Group>
      {steps.length ? (
        <>
          <div className={classes.steps}>
            {steps.map((s) => (
              <Step key={s.place} step={s} />
            ))}
          </div>
          {compact ? null : (
            <Text size="xs" c="dimmed" mt="sm">
              {RANKING_NOTE}
            </Text>
          )}
        </>
      ) : (
        <Empty title="No games played yet">The podium fills up once results come in.</Empty>
      )}
    </Card>
  )
}

const ICONS = { streak: IconFlame, active: IconRepeat, rivalry: IconSwords, best: IconTrophy } as const

export function Highlights({ compact = false }: { compact?: boolean }) {
  const { league, stats } = useLeague()
  const items = highlights(league, stats)
  if (!items.length) return null
  if (compact) {
    return (
      <Stack gap={6}>
        {items.map((h) => {
          const Icon = ICONS[h.id as keyof typeof ICONS] ?? IconTrophy
          return (
            <Group key={h.id} gap="sm" wrap="nowrap" className={classes.kpi}>
              <ThemeIcon size={32} radius="md" variant="light">
                <Icon size={16} />
              </ThemeIcon>
              <div style={{ minWidth: 0 }}>
                <Text size="xs" c="dimmed" lh={1.2}>
                  {h.title}
                </Text>
                <Text size="sm" fw={600} truncate lh={1.3}>
                  {h.value}
                </Text>
                <Text size="xs" c="dimmed" lh={1.2}>
                  {h.detail}
                </Text>
              </div>
            </Group>
          )
        })}
      </Stack>
    )
  }
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
      {items.map((h) => {
        const Icon = ICONS[h.id as keyof typeof ICONS] ?? IconTrophy
        return (
          <Card key={h.id} padding="md">
            <Group wrap="nowrap" gap="sm">
              <ThemeIcon size={40} radius="md" variant="light">
                <Icon size={20} />
              </ThemeIcon>
              <div style={{ minWidth: 0 }}>
                <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>
                  {h.title}
                </Text>
                <Text fw={600} truncate>
                  {h.value}
                </Text>
                <Text size="sm" c="dimmed">
                  {h.detail}
                </Text>
              </div>
            </Group>
          </Card>
        )
      })}
    </SimpleGrid>
  )
}
