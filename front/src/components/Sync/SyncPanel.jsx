import { useState } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

export default function SyncPanel({ onSynced }) {
  const { spotify, youtube } = useAuth()
  const [loading, setLoading] = useState({ spotify: false, youtube: false, local: false })
  const [messages, setMessages] = useState([])

  const addMsg = (msg) => setMessages(prev => [msg, ...prev].slice(0, 10))

  const handleSpotifySync = async () => {
    setLoading(l => ({ ...l, spotify: true }))
    try {
      const res = await api.syncFromSpotify()
      addMsg(`Spotify: ${res.message}`)
      onSynced?.()
    } catch (e) {
      addMsg(`Spotify error: ${e.message}`)
    } finally {
      setLoading(l => ({ ...l, spotify: false }))
    }
  }

  const handleYoutubeSync = async () => {
    setLoading(l => ({ ...l, youtube: true }))
    try {
      const res = await api.syncToYoutube()
      addMsg(`YouTube: ${res.message}`)
    } catch (e) {
      addMsg(`YouTube error: ${e.message}`)
    } finally {
      setLoading(l => ({ ...l, youtube: false }))
    }
  }

  const handleLocalScan = async () => {
    setLoading(l => ({ ...l, local: true }))
    try {
      const res = await api.scanLocal()
      addMsg(`Local scan: ${res.added} added, ${res.updated} updated`)
      onSynced?.()
    } catch (e) {
      addMsg(`Local scan error: ${e.message}`)
    } finally {
      setLoading(l => ({ ...l, local: false }))
    }
  }

  return (
    <div className="card">
      <div className="card-header fw-semibold">Sync</div>
      <div className="card-body d-flex flex-column gap-2">
        <button
          className="btn btn-success w-100"
          onClick={handleSpotifySync}
          disabled={!spotify.connected || loading.spotify}
        >
          {loading.spotify
            ? <span className="spinner-border spinner-border-sm me-2" />
            : <i className="bi bi-spotify me-2" />}
          {spotify.connected ? 'Sync from Spotify' : 'Connect Spotify first'}
        </button>

        <button
          className="btn btn-danger w-100"
          onClick={handleYoutubeSync}
          disabled={!youtube.connected || loading.youtube}
        >
          {loading.youtube
            ? <span className="spinner-border spinner-border-sm me-2" />
            : <i className="bi bi-youtube me-2" />}
          {youtube.connected ? 'Sync to YouTube Music' : 'Set up ytmusic_auth.json first'}
        </button>

        <button
          className="btn btn-outline-secondary w-100"
          onClick={handleLocalScan}
          disabled={loading.local}
        >
          {loading.local
            ? <span className="spinner-border spinner-border-sm me-2" />
            : <i className="bi bi-folder-fill me-2" />}
          Scan Local Folder
        </button>

        {messages.length > 0 && (
          <div className="mt-2">
            {messages.map((m, i) => (
              <div key={i} className="small text-secondary border-bottom py-1">{m}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
