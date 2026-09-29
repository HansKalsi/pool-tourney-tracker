// The office time slots players can mark themselves as available for.
// Edit this list to change the options — ids are stored per player, so keep existing ids stable.

export interface PlaySlot {
  id: string
  /** 0 = Sunday … 6 = Saturday */
  day: number
  dayName: string
  startHour: number
  endHour: number
}

export const PLAY_SLOTS: PlaySlot[] = [
  { id: 'tue-12', day: 2, dayName: 'Tuesday', startHour: 12, endHour: 13 },
  { id: 'tue-13', day: 2, dayName: 'Tuesday', startHour: 13, endHour: 14 },
  { id: 'wed-12', day: 3, dayName: 'Wednesday', startHour: 12, endHour: 13 },
  { id: 'wed-13', day: 3, dayName: 'Wednesday', startHour: 13, endHour: 14 },
]

export const SLOT_IDS = new Set(PLAY_SLOTS.map((s) => s.id))

const hour12 = (h: number) => ((h + 11) % 12) + 1
const meridiem = (h: number) => (h < 12 ? 'am' : 'pm')

/** "12–1pm", "1–2pm", "11am–12pm" */
export function slotTimeLabel(slot: PlaySlot) {
  const { startHour: s, endHour: e } = slot
  const start = meridiem(s) === meridiem(e) ? `${hour12(s)}` : `${hour12(s)}${meridiem(s)}`
  return `${start}–${hour12(e)}${meridiem(e)}`
}

/** "Tue 12–1pm" */
export const slotLabel = (slot: PlaySlot) => `${slot.dayName.slice(0, 3)} ${slotTimeLabel(slot)}`

/** Next start of this slot strictly after `from` (local time). */
export function nextOccurrence(slot: PlaySlot, from: Date = new Date()): Date {
  const d = new Date(from)
  d.setHours(slot.startHour, 0, 0, 0)
  d.setDate(d.getDate() + ((slot.day - d.getDay() + 7) % 7))
  if (d <= from) d.setDate(d.getDate() + 7)
  return d
}

/** Groups slots by weekday, in list order, for display. */
export function slotsByDay() {
  const days: { dayName: string; slots: PlaySlot[] }[] = []
  for (const slot of PLAY_SLOTS) {
    const last = days.at(-1)
    if (last?.dayName === slot.dayName) last.slots.push(slot)
    else days.push({ dayName: slot.dayName, slots: [slot] })
  }
  return days
}
