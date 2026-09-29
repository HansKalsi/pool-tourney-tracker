import { SegmentedControl, Text, ThemeIcon, Tooltip } from '@mantine/core'
import dayjs from 'dayjs'
import { useState } from 'react'
import type { ActivityCategory } from '../../shared/types'
import { dateTimeLabel, timeAgo } from '../lib/format'
import { useLeague } from '../lib/league'
import classes from './ActivityLog.module.scss'
import { IconCalendarClock, IconShield, IconUserPlus } from './icons'
import { Empty } from './ui'

const ICON: Record<ActivityCategory, { icon: typeof IconShield; color: string }> = {
  games: { icon: IconCalendarClock, color: 'felt' },
  players: { icon: IconUserPlus, color: 'blue' },
  admin: { icon: IconShield, color: 'orange' },
}

/** Everything admins (and anonymous play-time edits) have changed, newest first. Admin-only. */
export function ActivityLog() {
  const { activity = [] } = useLeague()
  const [filter, setFilter] = useState<'all' | ActivityCategory>('all')
  const shown = filter === 'all' ? activity : activity.filter((e) => e.category === filter)

  return (
    <div className={classes.root}>
      <div className={classes.head}>
        <div>
          <Text fw={650}>Activity log</Text>
          <Text size="xs" c="dimmed">
            What's been changed and by whom · only admins can see this
          </Text>
        </div>
        <SegmentedControl
          size="xs"
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          data={[
            { value: 'all', label: 'All' },
            { value: 'games', label: 'Games' },
            { value: 'players', label: 'Players' },
            { value: 'admin', label: 'Admin & setup' },
          ]}
        />
      </div>
      <div className={classes.list}>
        {shown.length ? (
          shown.map((e) => {
            const { icon: Icon, color } = ICON[e.category]
            return (
              <div key={e.id} className={classes.entry}>
                <ThemeIcon size={26} radius="xl" variant="light" color={color}>
                  <Icon size={14} />
                </ThemeIcon>
                <div className={classes.text}>
                  {e.actor ? <strong>{e.actor}</strong> : <span className={classes.anon}>Someone</span>}
                  {e.actor && !e.claimed ? null : (
                    <Tooltip label={e.actor ? `Said they were ${e.actor} — not signed in as an admin` : 'Not signed in as an admin'}>
                      <span className={classes.anon}> (not signed in)</span>
                    </Tooltip>
                  )}{' '}
                  {e.text}
                  {e.when ? (
                    <span className={classes.when}>
                      <IconCalendarClock size={12} />
                      {dateTimeLabel(e.when)}
                    </span>
                  ) : null}
                </div>
                <Tooltip label={dayjs(e.at).format('ddd D MMM YYYY, HH:mm:ss')}>
                  <span className={classes.time}>{timeAgo(e.at)}</span>
                </Tooltip>
              </div>
            )
          })
        ) : (
          <div style={{ padding: 12 }}>
            <Empty title={activity.length ? 'Nothing in this category yet' : 'No activity yet'}>
              {activity.length ? null : 'Changes made from now on will show up here.'}
            </Empty>
          </div>
        )}
      </div>
    </div>
  )
}
