import type { Player } from '../../shared/types'
import { useBallNumber } from '../lib/league'
import classes from './Avatar.module.scss'

// Standard pool-ball colours for 1–7 (stripes 9–15 reuse them); 8 is the black.
const COLORS = ['#f4b400', '#1d4ed8', '#d42a1e', '#5b2a86', '#f26b1d', '#137a3f', '#7a1c24']
const CREAM = '#fbf6e6'

function ballStyle(n: number) {
  if (n === 8) return { color: '#18181b', stripe: false }
  if (n < 1 || n > 15) return { color: '#a1a1aa', stripe: false }
  // 9–15 are the striped versions of 1–7.
  return { color: COLORS[(n > 8 ? n - 8 : n) - 1], stripe: n > 8 }
}

export const initials = (name: string) => (name.trim()[0] ?? '?').toUpperCase()

/** The player's pool ball, with their initial where the number would be. */
export function Avatar({ player, size = 'md', className }: { player: Player | undefined; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const n = useBallNumber(player?.id)
  const { color, stripe } = ballStyle(n)
  return (
    <span
      className={[classes.ball, classes[size], className].filter(Boolean).join(' ')}
      style={{ '--ball-color': color, '--ball-cream': CREAM } as React.CSSProperties}
      data-stripe={stripe || undefined}
      title={player?.name}
      aria-hidden
    >
      <span className={classes.spot}>{initials(player?.name ?? '?')}</span>
    </span>
  )
}
