import { toast } from '../components/Toast'

export function copy(text: string, message = 'Copied to clipboard') {
  navigator.clipboard.writeText(text).then(
    () => toast(message),
    () => toast("Couldn't copy automatically — select the text and copy it manually.", 'error'),
  )
}
