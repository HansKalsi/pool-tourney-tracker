import { describe, expect, it } from 'vitest'
import { nextOccurrence, PLAY_SLOTS, slotLabel, slotTimeLabel } from './slots.js'

const slot = (id: string) => PLAY_SLOTS.find((s) => s.id === id)!

describe('slots', () => {
  it('labels slots compactly', () => {
    expect(slotTimeLabel(slot('tue-12'))).toBe('12–1pm')
    expect(slotLabel(slot('wed-13'))).toBe('Wed 1–2pm')
    expect(slotTimeLabel({ id: 'x', day: 1, dayName: 'Monday', startHour: 11, endHour: 12 })).toBe('11am–12pm')
  })

  it('finds the next occurrence of a slot', () => {
    const tuesdayMorning = new Date(2026, 8, 29, 9, 0) // Tue 29 Sep 2026, 09:00
    expect(nextOccurrence(slot('tue-12'), tuesdayMorning)).toEqual(new Date(2026, 8, 29, 12, 0))
    expect(nextOccurrence(slot('wed-13'), tuesdayMorning)).toEqual(new Date(2026, 8, 30, 13, 0))
    // Already started today → next week.
    expect(nextOccurrence(slot('tue-12'), new Date(2026, 8, 29, 12, 30))).toEqual(new Date(2026, 9, 6, 12, 0))
  })
})
