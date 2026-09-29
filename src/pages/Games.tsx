import { Button, SegmentedControl } from '@mantine/core'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { GameList } from '../components/GameRow'
import { IconRepeat } from '../components/icons'
import { ScheduleCalendar } from '../components/ScheduleCalendar'
import { Empty } from '../components/ui'
import { useLeague } from '../lib/league'
import classes from './Games.module.scss'
import { AdminQuickActions, useFixtures } from './Overview'

type View = 'calendar' | 'upcoming' | 'unbooked' | 'played'
const VIEWS: View[] = ['calendar', 'upcoming', 'unbooked', 'played']

export default function Games() {
  const { isAdmin, run } = useLeague()
  const [params, setParams] = useSearchParams()
  const [starting, setStarting] = useState(false)
  const view: View = VIEWS.find((v) => v === params.get('view')) ?? 'calendar'
  const { booked, unbooked, played } = useFixtures()

  async function newRound() {
    setStarting(true)
    await run({ action: 'generateFixtures', scope: 'all' }, 'New round of matchups added')
    setStarting(false)
  }

  return (
    <div className={classes.layout}>
      <div className={classes.toolbar}>
        <SegmentedControl
          size="sm"
          radius="md"
          value={view}
          onChange={(v) => setParams(v === 'calendar' ? {} : { view: v }, { replace: true })}
          data={[
            { value: 'calendar', label: 'Calendar' },
            { value: 'upcoming', label: `Booked · ${booked.length}` },
            { value: 'unbooked', label: `To book · ${unbooked.length}` },
            { value: 'played', label: `Results · ${played.length}` },
          ]}
        />
        <AdminQuickActions size="xs" />
      </div>

      <div className={classes.body} data-view={view}>
        {view === 'calendar' && <ScheduleCalendar />}

        {view === 'upcoming' && (booked.length ? <GameList matches={booked} /> : <Empty title="Nothing booked right now" />)}

        {view === 'unbooked' &&
          (unbooked.length ? (
            <GameList matches={unbooked} />
          ) : (
            <Empty title="Every matchup is booked or played">
              {isAdmin ? (
                <Button mt="sm" variant="light" leftSection={<IconRepeat size={16} />} onClick={newRound} loading={starting}>
                  Start another round
                </Button>
              ) : null}
            </Empty>
          ))}

        {view === 'played' && (played.length ? <GameList matches={played} /> : <Empty title="No results yet" />)}
      </div>
    </div>
  )
}
