import { Fragment, useState } from 'react'
import { usePlayer } from '../../contexts/PlayerContext'
import TrackDetail from './TrackDetail'

function formatMs(ms) {
  if (!ms) return '--'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function SourceBadges({ track }) {
  return (
    <span className="d-flex gap-1">
      {track.spotify_id && <i className="bi bi-spotify text-success" title="Spotify" />}
      {track.youtube_id && <i className="bi bi-music-note-beamed text-danger" title="YouTube Music (audio)" />}
      {track.youtube_video_id && <i className="bi bi-youtube text-danger" title="YouTube video" />}
      {track.local_path && <i className="bi bi-folder-fill text-warning" title="Local" />}
    </span>
  )
}

const COLUMNS = [
  { label: 'Title', sort: 'title' },
  { label: 'Artist', sort: 'artist' },
  { label: 'Album', sort: 'album' },
  { label: 'Duration', sort: 'duration' },
  { label: 'Added', sort: 'added' },
  { label: 'Sources' },
]

// Height of the sticky search bar in Home.jsx; the header sticks right below it.
export const SEARCH_BAR_HEIGHT = 72

const stickyTh = {
  position: 'sticky',
  top: SEARCH_BAR_HEIGHT,
  zIndex: 2,
  background: '#212529',
  color: '#fff',
}

export default function TrackTable({ tracks, loading, sort, onSort, onTrackChange, showIndex = false }) {
  const { currentTrack, playing } = usePlayer()
  const [openId, setOpenId] = useState(null)  // track whose detail panel is expanded

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" />
      </div>
    )
  }

  if (!tracks.length) {
    return (
      <div className="text-center py-5 text-secondary">
        <i className="bi bi-music-note-list fs-1 d-block mb-2" />
        No tracks yet. Sync from Spotify or scan your local folder.
      </div>
    )
  }

  return (
    // No .table-responsive wrapper: its overflow would break the sticky header.
    <div>
      <table className="table table-hover align-middle mb-0">
        <thead>
          <tr>
            {showIndex && (
              <th style={{ width: 48, ...stickyTh, cursor: 'pointer', userSelect: 'none' }} onClick={() => onSort('position')}>
                #{sort?.key === 'position' && (
                  <i className={`bi ms-1 ${sort.dir === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill'}`} />
                )}
              </th>
            )}
            <th style={{ width: 48, ...stickyTh }} />
            {COLUMNS.map(col => (
              <th
                key={col.label}
                style={{ ...stickyTh, cursor: col.sort ? 'pointer' : 'default', userSelect: 'none' }}
                onClick={col.sort ? () => onSort(col.sort) : undefined}
              >
                {col.label}
                {col.sort && sort?.key === col.sort && (
                  <i className={`bi ms-1 ${sort.dir === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill'}`} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tracks.map((track, index) => {
            const isActive = currentTrack?.id === track.id
            return (
              <Fragment key={track.id}>
              <tr
                className={isActive ? 'table-primary' : openId === track.id ? 'table-active' : ''}
                style={{ cursor: 'pointer' }}
                onClick={() => setOpenId(id => (id === track.id ? null : track.id))}
              >
                {showIndex && <td className="text-secondary">{index + 1}</td>}
                <td>
                  {track.cover_url
                    ? <img src={track.cover_url} alt="" width={40} height={40} className="rounded" />
                    : <div className="bg-secondary rounded d-flex align-items-center justify-content-center" style={{ width: 40, height: 40 }}>
                        <i className="bi bi-music-note text-white" />
                      </div>
                  }
                </td>
                <td>
                  <span className="fw-semibold">{track.title}</span>
                  {track.explicit && <span className="badge bg-secondary ms-1 small">E</span>}
                  {isActive && playing && <i className="bi bi-volume-up-fill ms-2 text-primary" />}
                </td>
                <td className="text-secondary">{track.artist}</td>
                <td className="text-secondary text-truncate" style={{ maxWidth: 200 }}>{track.album || '--'}</td>
                <td className="text-secondary">{formatMs(track.duration_ms)}</td>
                <td className="text-secondary text-nowrap">
                  {track.created_at ? new Date(track.created_at).toLocaleDateString() : '--'}
                </td>
                <td><SourceBadges track={track} /></td>
              </tr>
              {openId === track.id && (
                <tr>
                  <td colSpan={showIndex ? 8 : 7} className="bg-body-secondary p-0">
                    <TrackDetail track={track} onChange={onTrackChange} />
                  </td>
                </tr>
              )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
