import { useState } from 'react'
import { api } from '../../api/client'
import { usePlayer } from '../../contexts/PlayerContext'

const SOURCE_ICON = {
  spotify: 'bi-spotify text-success',
  youtube: 'bi-youtube text-danger',
  local: 'bi-folder-fill text-warning',
  mixed: 'bi-collection-fill text-info',
}

export default function PlaylistList({ playlists, loading, onToggle }) {
  const { playFromPlaylist } = usePlayer()
  const [playing, setPlaying] = useState(null)  // playlist id currently loading

  if (loading) return <div className="text-center py-4"><div className="spinner-border" /></div>

  if (!playlists.length) {
    return <p className="text-secondary text-center py-4">No playlists. Sync from Spotify first.</p>
  }

  const sorted = [...playlists].sort((a, b) => {
    if (a.sync_enabled !== b.sync_enabled) return a.sync_enabled ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  const handleToggle = async (pl) => {
    try {
      await api.updatePlaylist(pl.id, { sync_enabled: !pl.sync_enabled })
      onToggle?.()
    } catch (e) {
      console.error(e)
    }
  }

  const handlePlay = async (pl) => {
    if (playing === pl.id) return
    setPlaying(pl.id)
    try {
      await playFromPlaylist(pl.id)
    } catch (e) {
      console.error(e)
    } finally {
      setPlaying(null)
    }
  }

  return (
    <div className="list-group">
      {sorted.map(pl => (
        <div key={pl.id} className="list-group-item d-flex align-items-center gap-3">
          {pl.cover_url
            ? <img src={pl.cover_url} alt="" width={44} height={44} className="rounded" />
            : <div className="bg-secondary rounded d-flex align-items-center justify-content-center" style={{ width: 44, height: 44 }}>
                <i className={`bi ${SOURCE_ICON[pl.source] || 'bi-music-note'} fs-5`} />
              </div>
          }
          <div className="flex-grow-1">
            <div className="fw-semibold">{pl.name}</div>
            <div className="small text-secondary">
              <i className={`bi ${SOURCE_ICON[pl.source]} me-1`} />
              {pl.track_count} tracks
              {pl.last_synced_at && ` · synced ${new Date(pl.last_synced_at).toLocaleDateString()}`}
            </div>
          </div>

          {/* Play button — only for active (sync-enabled) playlists */}
          {pl.sync_enabled ? (
            <button
              className="btn btn-sm btn-outline-success rounded-circle d-flex align-items-center justify-content-center"
              style={{ width: 32, height: 32, flexShrink: 0 }}
              onClick={() => handlePlay(pl)}
              disabled={playing === pl.id || !pl.track_count}
              title={`Play ${pl.name}`}
            >
              {playing === pl.id
                ? <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12, borderWidth: 2 }} />
                : <i className="bi bi-play-fill" style={{ fontSize: 14 }} />
              }
            </button>
          ) : (
            <div style={{ width: 32, flexShrink: 0 }} />
          )}

          {/* Sync toggle */}
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              checked={pl.sync_enabled}
              onChange={() => handleToggle(pl)}
              title="Enable sync"
            />
          </div>
        </div>
      ))}
    </div>
  )
}
