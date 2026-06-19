import { Routes, Route, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PlayerProvider } from './contexts/PlayerContext'
import GlobalPlayer from './components/Player/GlobalPlayer'
import Home from './pages/Home'
import Playlists from './pages/Playlists'
import Sync from './pages/Sync'
import Settings from './pages/Settings'

function Nav() {
  const { spotify, youtube } = useAuth()
  return (
    <nav className="navbar navbar-expand-md navbar-dark bg-dark border-bottom border-secondary">
      <div className="container-fluid">
        <span className="navbar-brand fw-bold">
          <i className="bi bi-music-note-beamed me-2" />Music Sync
        </span>
        <div className="navbar-nav me-auto d-flex flex-row gap-3">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active fw-semibold' : ''}`}>
            <i className="bi bi-music-note-list me-1" />Tracks
          </NavLink>
          <NavLink to="/playlists" className={({ isActive }) => `nav-link ${isActive ? 'active fw-semibold' : ''}`}>
            <i className="bi bi-collection me-1" />Playlists
          </NavLink>
          <NavLink to="/sync" className={({ isActive }) => `nav-link ${isActive ? 'active fw-semibold' : ''}`}>
            <i className="bi bi-arrow-repeat me-1" />Sync
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active fw-semibold' : ''}`}>
            <i className="bi bi-gear me-1" />Settings
          </NavLink>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <span title="Spotify" className={`bi bi-spotify fs-5 ${spotify.connected ? 'text-success' : 'text-secondary'}`} />
          <span title="YouTube Music" className={`bi bi-youtube fs-5 ${youtube.connected ? 'text-danger' : 'text-secondary'}`} />
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <div className="d-flex flex-column min-vh-100 bg-body-tertiary">
          <Nav />
          <main className="container-fluid py-3 px-3 flex-grow-1" style={{ paddingBottom: '80px' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/playlists" element={<Playlists />} />
              <Route path="/sync" element={<Sync />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
          <GlobalPlayer />
        </div>
      </PlayerProvider>
    </AuthProvider>
  )
}
