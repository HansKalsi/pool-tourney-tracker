import type { Match, Player } from '../../shared/types'

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const escape = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')

/** Downloads a calendar invite for a booked game (works with Google, Outlook, Apple Calendar). */
export function downloadIcs(match: Match, players: Player[], leagueName: string) {
  if (!match.scheduledAt) return
  const [a, b] = match.playerIds.map((id) => players.find((p) => p.id === id)?.name ?? 'Unknown')
  const start = new Date(match.scheduledAt)
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pool League//EN',
    'BEGIN:VEVENT',
    `UID:${match.id}@pool-league`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(`🎱 ${a} vs ${b}`)}`,
    `DESCRIPTION:${escape(`${leagueName} — ${window.location.href}`)}`,
    match.location ? `LOCATION:${escape(match.location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${a}-vs-${b}.ics`.replace(/\s+/g, '-').toLowerCase()
  link.click()
  URL.revokeObjectURL(url)
}
