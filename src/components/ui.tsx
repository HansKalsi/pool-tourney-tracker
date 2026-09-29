import { EmptyState, Group, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <Group justify="space-between" align="flex-end" gap="sm" mb="sm" wrap="nowrap">
      <div>
        <Title order={2} fz="lg" fw={650}>
          {title}
        </Title>
        {subtitle ? (
          <Text size="sm" c="dimmed">
            {subtitle}
          </Text>
        ) : null}
      </div>
      {action}
    </Group>
  )
}

/** Mantine's EmptyState in a dashed frame, used for every "nothing here yet" spot. */
export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={children}
      size="sm"
      variant="light"
      p="xl"
      style={{ border: '1px dashed var(--app-border)', borderRadius: 'var(--mantine-radius-lg)' }}
    />
  )
}
