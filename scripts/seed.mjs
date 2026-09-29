// Creates a demo league with dummy players, results and bookings through the API.
// Usage: npm run dev   (in another terminal), then   npm run seed   [base url, default http://localhost:5173]
const BASE = process.argv[2] ?? 'http://localhost:5173'

async function call(body, token) {
  const res = await fetch(`${BASE}/api/league`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'x-admin-token': token } : {}) },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`${body.action}: ${data.error}`)
  return data
}

const day = (offset, hour = 17, minute = 30) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

const names = ['Hans', 'Priya', 'Marcus', 'Chloe', 'Tomás', 'Aisha', 'Ben']
const created = await call({ action: 'createLeague', name: 'Office 8-Ball League', adminName: 'Hans', players: names })
const { token } = created
const leagueId = created.league.id
const id = Object.fromEntries(created.league.players.map((p) => [p.name, p.id]))

// [player, opponent, winner, method, days ago]
const results = [
  ['Hans', 'Priya', 'Priya', 'standard', 14],
  ['Marcus', 'Chloe', 'Marcus', 'standard', 14],
  ['Tomás', 'Aisha', 'Aisha', 'default', 12],
  ['Ben', 'Hans', 'Hans', 'standard', 11],
  ['Priya', 'Marcus', 'Priya', 'standard', 9],
  ['Chloe', 'Tomás', 'Chloe', 'standard', 8],
  ['Aisha', 'Ben', 'Aisha', 'standard', 7],
  ['Hans', 'Marcus', 'Hans', 'default', 6],
  ['Priya', 'Chloe', 'Priya', 'standard', 5],
  ['Ben', 'Tomás', 'Tomás', 'standard', 4],
  ['Hans', 'Priya', 'Hans', 'standard', 2],
  ['Aisha', 'Marcus', 'Marcus', 'standard', 1],
  ['Priya', 'Aisha', 'Priya', 'default', 0],
  ['Chloe', 'Hans', 'Hans', 'standard', 0],
]
for (const [a, b, w, method, ago] of results) {
  await call(
    { action: 'createMatch', leagueId, playerIds: [id[a], id[b]], scheduledAt: null, location: null, result: { winnerId: id[w], method, playedAt: day(-ago, 12 + (ago % 5), 15) } },
    token,
  )
}

const bookings = [
  ['Marcus', 'Ben', 1, 12, 30, 'Office table'],
  ['Chloe', 'Aisha', 2, 17, 45, 'Office table'],
  ['Tomás', 'Hans', 5, 13, 0, 'The Crown'],
  ['Priya', 'Ben', 8, 17, 30, 'Office table'],
]
for (const [a, b, inDays, h, m, location] of bookings) {
  await call({ action: 'createMatch', leagueId, playerIds: [id[a], id[b]], scheduledAt: day(inDays, h, m), location, result: null }, token)
}
// One booked slot in the past with no result yet, to show the "awaiting result" state.
await call({ action: 'createMatch', leagueId, playerIds: [id['Aisha'], id['Hans']], scheduledAt: day(0, 9, 0), location: 'Office table', result: null }, token)
// Preferred office slots (Ben hasn't picked any yet, to show that state).
const availability = {
  Hans: ['tue-12', 'wed-13'],
  Priya: ['tue-12', 'tue-13', 'wed-12'],
  Marcus: ['wed-12', 'wed-13'],
  Chloe: ['tue-13', 'wed-13'],
  Tomás: ['tue-12', 'wed-12', 'wed-13'],
  Aisha: ['tue-13'],
}
for (const [name, slots] of Object.entries(availability)) {
  await call({ action: 'setAvailability', leagueId, playerId: id[name], slots })
}
// Every remaining pairing becomes an unbooked matchup.
await call({ action: 'generateFixtures', leagueId, scope: 'unplayed' }, token)

console.log(`\nDemo league ready.\n  Public view: ${BASE}/l/${leagueId}\n  Admin link:  ${BASE}/l/${leagueId}#key=${token}\n`)
