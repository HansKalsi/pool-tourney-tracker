import { Box, Button } from '@mantine/core'
import { createBrowserRouter, Link, RouterProvider } from 'react-router'
import { ConfirmProvider } from './components/Confirm'
import { Empty } from './components/ui'
import AdminPage from './pages/AdminPage'
import Games from './pages/Games'
import Home from './pages/Home'
import LeagueLayout from './pages/LeagueLayout'
import Overview from './pages/Overview'
import PlayerPage from './pages/PlayerPage'
import Players from './pages/Players'

function NotFound() {
  return (
    <Box maw={420} mx="auto" px="md" py={80}>
      <Empty title="Page not found">
        <Button component={Link} to="/" variant="light" mt="xs">
          Go home
        </Button>
      </Empty>
    </Box>
  )
}

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  {
    path: '/l/:leagueId',
    element: <LeagueLayout />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'games', element: <Games /> },
      { path: 'players', element: <Players /> },
      { path: 'players/:playerId', element: <PlayerPage /> },
      { path: 'admin', element: <AdminPage /> },
    ],
  },
  { path: '*', element: <NotFound /> },
])

export default function App() {
  return (
    <ConfirmProvider>
      <RouterProvider router={router} />
    </ConfirmProvider>
  )
}
