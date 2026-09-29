import dayjs from 'dayjs'

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, tomorrow)) return 'Tomorrow'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

export const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export const dateTimeLabel = (iso: string) => `${dayLabel(iso)}, ${timeLabel(iso)}`

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/** ISO/Date → Mantine date picker value ("YYYY-MM-DD HH:mm:ss", local time). */
export const toPickerValue = (value: string | Date | null) => dayjs(value ?? new Date()).format('YYYY-MM-DD HH:mm:ss')

/** Mantine date picker value (local time) → ISO. */
export const fromPickerValue = (value: string) => dayjs(value).toISOString()

/** "just now", "5 min ago", "3 h ago", "Yesterday 14:02", "Tue 22 Sept, 14:02" */
export function timeAgo(iso: string, now = Date.now()) {
  const mins = Math.round((now - Date.parse(iso)) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 6 * 60) return `${Math.round(mins / 60)} h ago`
  return `${dayLabel(iso)}, ${timeLabel(iso)}`
}

export const pct = (n: number) => `${Math.round(n * 100)}%`

export const plural = (n: number, word: string, pluralWord = `${word}s`) => `${n} ${n === 1 ? word : pluralWord}`

/** For use mid-sentence: "today", "yesterday", or "on Tue 29 Sep". */
export function inlineDay(iso: string) {
  const d = dayLabel(iso)
  return /^(Today|Tomorrow|Yesterday)$/.test(d) ? d.toLowerCase() : `on ${d}`
}
