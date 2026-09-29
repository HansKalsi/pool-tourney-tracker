import { createTheme, type MantineColorsTuple } from '@mantine/core'

// Pool-table felt green.
const felt: MantineColorsTuple = ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b']

export const theme = createTheme({
  primaryColor: 'felt',
  primaryShade: { light: 7, dark: 6 },
  colors: { felt },
  cursorType: 'pointer',
  defaultRadius: 'md',
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  headings: { fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", fontWeight: '700' },
  components: {
    Button: { defaultProps: { radius: 'md' } },
    Modal: { defaultProps: { centered: true, radius: 'lg', overlayProps: { backgroundOpacity: 0.45, blur: 2 } } },
    Menu: { defaultProps: { radius: 'md', shadow: 'md', position: 'bottom-end' } },
    Card: { defaultProps: { radius: 'lg', withBorder: true } },
    Paper: { defaultProps: { radius: 'lg' } },
    Tooltip: { defaultProps: { withArrow: true, openDelay: 250 } },
  },
})
