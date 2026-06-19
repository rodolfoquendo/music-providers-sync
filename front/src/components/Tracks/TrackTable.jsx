import { usePlayer } from '../../contexts/PlayerContext'

function formatMs(ms) {
  if (!ms) return '--'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function SourceBadges({ track }) {
  return (
    <span className="d-flex gap-1">
      {track.spotify_id && <i className="bi bi-spotify text-success" title="Spotify" />}
      {track.youtube_id && <i className="bi bi-youtube text-danger" title="YouTube Music" />}
      {track.local_path && <i className="bi bi-folder-fill text-warning" title="Local" />}
    </span>
  )
}

export default function TrackTable({ tracks, loading }) {
  const { play, currentTrack, playing } = usePlayer()

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
    <div className="table-responsive">
      <table className="table table-hover align-middle mb-0">
        <thead className="table-dark sticky-top">
          <tr>
            <th style={{ width: 48 }} />
            <th>Title</th>
            <th>Artist</th>
            <th>Album</th>
            <th>Duration</th>
            <th>Sources</th>
          </tr>
        </thead>
        <tbody>
          {tracks.map(track => {
            const isActive = currentTrack?.id === track.id
            return (
              <tr
                key={track.id}
                className={isActive ? 'table-primary' : ''}
                style={{ cursor: 'pointer' }}
                onClick={() => play(track)}
              >
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
                <td><SourceBadges track={track} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
