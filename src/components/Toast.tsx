import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCheck } from './icons'

type Kind = 'success' | 'error'

/** Small wrapper so pages can just call toast('Saved') / toast('Oops', 'error'). */
export function toast(message: string, kind: Kind = 'success') {
  notifications.show({
    message,
    color: kind === 'success' ? 'felt' : 'red',
    icon: kind === 'success' ? <IconCheck size={16} /> : <IconAlertCircle size={16} />,
    autoClose: kind === 'error' ? 5000 : 2500,
    radius: 'lg',
    withBorder: true,
  })
}

export const useToast = () => toast
