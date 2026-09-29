import { useEffect, useRef, useState } from 'react'
import { shortDate } from '../lib/format'
import { useLeague } from '../lib/league'
import { STARTING_RATING, type TimelineEntry } from '../lib/stats'
import classes from './RatingChart.module.scss'

const PAD = { top: 16, right: 16, bottom: 28, left: 44 }

/** Skill rating after each game, with the 1000 starting line as a reference. */
export function RatingChart({ entries, height: HEIGHT = 200 }: { entries: TimelineEntry[]; height?: number }) {
  const { player } = useLeague()
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = entries.length
  const values = [STARTING_RATING, ...entries.map((e) => e.rating)]
  // Round the domain out to tens with a little headroom so the line never hugs the edges.
  const lo = Math.floor((Math.min(...values) - 5) / 10) * 10
  const hi = Math.ceil((Math.max(...values) + 5) / 10) * 10
  const innerW = width - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom
  // Game 0 = the starting rating, then one point per game.
  const x = (i: number) => PAD.left + (n ? (i / n) * innerW : 0)
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const yTicks = [...new Set([lo, STARTING_RATING, hi])].sort((a, b) => a - b)
  const xTickEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 48))))

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const gx = Math.round(((e.clientX - rect.left) / rect.width) * n)
    setHover(Math.min(n, Math.max(1, gx)) - 1)
  }

  const h = hover !== null ? entries[hover] : null

  return (
    <div ref={wrap} className={classes.wrap}>
      <svg width={width} height={HEIGHT} role="img" aria-label={`Skill rating over ${n} games, now ${values.at(-1)}`} className={classes.svg}>
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className={t === STARTING_RATING ? classes.baseline : classes.grid}
              strokeDasharray={t === STARTING_RATING ? '4 4' : undefined}
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className={classes.tick}>
              {t}
            </text>
          </g>
        ))}
        {entries.map((e) =>
          e.gameNumber % xTickEvery === 0 || e.gameNumber === 1 ? (
            <text key={e.gameNumber} x={x(e.gameNumber)} y={HEIGHT - 8} textAnchor="middle" className={classes.tick}>
              {e.gameNumber}
            </text>
          ) : null,
        )}
        <path d={path} fill="none" className={classes.line} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {h ? <line x1={x(h.gameNumber)} x2={x(h.gameNumber)} y1={PAD.top} y2={PAD.top + innerH} className={classes.crosshair} strokeDasharray="3 3" /> : null}
        {entries.map((e) => {
          const won = e.outcome !== 'loss'
          const active = hover === e.gameNumber - 1
          return (
            <circle
              key={e.gameNumber}
              cx={x(e.gameNumber)}
              cy={y(e.rating)}
              r={active ? 6 : 4.5}
              strokeWidth={2}
              className={won ? classes.dotWin : classes.dotLoss}
            />
          )
        })}
        <rect
          x={PAD.left}
          y={0}
          width={innerW}
          height={HEIGHT}
          fill="transparent"
          className={classes.hit}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {h ? (
        <div
          className={classes.tooltip}
          style={{ left: Math.min(width - 88, Math.max(88, x(h.gameNumber))), top: Math.max(0, y(h.rating) - 78) }}
        >
          <div className={classes.tooltipTitle}>
            Game {h.gameNumber} · {shortDate(h.match.result.playedAt)}
          </div>
          <div className={classes.tooltipLine}>
            {h.outcome === 'loss' ? 'Lost to' : h.outcome === 'default-win' ? 'Won by default vs' : 'Won vs'} {player(h.opponentId)?.name}
          </div>
          <div className={classes.tooltipLine}>
            Rating {h.rating} ({h.change > 0 ? '+' : '−'}
            {Math.abs(h.change)})
          </div>
        </div>
      ) : null}
      <div className={classes.legend}>
        <span>
          <span className={classes.keyWin} /> Win
        </span>
        <span>
          <span className={classes.keyLoss} /> Loss
        </span>
        <span>
          <span className={classes.keyBaseline} /> Start (1000)
        </span>
        <span className={classes.axisNote}>Game number →</span>
      </div>
    </div>
  )
}
