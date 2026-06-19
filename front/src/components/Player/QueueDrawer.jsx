import { useEffect, useState } from 'react'
import { usePlayer } from '../../contexts/PlayerContext'
import { api } from '../../api/client'


const PREVIEW = 30  // tracks to show before and after current

export default function QueueDrawer() {
  const { queue, queueIndex, queueOpen, setQueueOpen, currentTrack, playFromQueue, shuffleMode } = usePlayer()
  const [tracks, setTracks] = useState([])   // resolved track objects for the visible slice
  const [sliceStart, setSliceStart] = useState(0)

  useEffect(() => {
    if (!queueOpen || !queue.length) { setTracks([]); return }

    // Show PREVIEW tracks before + current + PREVIEW tracks after, clamped to array bounds
    const start = Math.max(0, queueIndex - PREVIEW)
    const end = Math.min(queue.length, queueIndex + PREVIEW + 1)
    setSliceStart(start)
    const slice = queue.slice(start, end)
    api.getTracksBatch(slice).then(setTracks).catch(() => {})
  }, [queueOpen, queue, queueIndex])

  if (!queueOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setQueueOpen(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1049 }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 72, width: 380,
          background: '#1a1a1a', zIndex: 1051, display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between px-3 py-3 border-bottom border-secondary">
          <div>
            <span className="fw-semibold text-white">Play Queue</span>
            <span className="ms-2" style={{ fontSize: 11, color: shuffleMode ? '#1db954' : '#888' }}>
              <i className={`bi ${shuffleMode ? 'bi-shuffle' : 'bi-arrow-down-up'} me-1`} />
              {shuffleMode ? 'Shuffled' : 'Sequential'} · {queueIndex + 1}/{queue.length}
            </span>
          </div>
          <button className="btn btn-link text-secondary p-0" onClick={() => setQueueOpen(false)}>
            <i className="bi bi-x-lg" style={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Track list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {tracks.length === 0 && queue.length > 0 ? (
            <div className="text-center py-5"><div className="spinner-border spinner-border-sm text-secondary" /></div>
          ) : tracks.length > 0 ? (
            <>
              {sliceStart > 0 && (
                <div className="text-secondary small text-center py-2">
                  ↑ {sliceStart} tracks above
                </div>
              )}

              {tracks.map((track, i) => {
                const absIdx = sliceStart + i
                const isCurrent = absIdx === queueIndex
                return (
                  <div
                    key={`${absIdx}-${track.id}`}
                    onClick={() => playFromQueue(absIdx)}
                    className={`d-flex align-items-center gap-2 px-3 py-2 ${isCurrent ? '' : 'queue-row'}`}
                    style={{
                      cursor: 'pointer',
                      background: isCurrent ? 'rgba(29,185,84,0.15)' : 'transparent',
                      borderLeft: isCurrent ? '3px solid #1db954' : '3px solid transparent',
                    }}
                  >
                    {/* Position number */}
                    <span className="text-secondary flex-shrink-0" style={{ width: 28, fontSize: 12, textAlign: 'right' }}>
                      {isCurrent
                        ? <i className="bi bi-volume-up-fill" style={{ color: '#1db954' }} />
                        : absIdx + 1}
                    </span>

                    {/* Cover */}
                    {track.cover_url
                      ? <img src={track.cover_url} alt="" width={36} height={36} className="rounded flex-shrink-0" />
                      : <div className="rounded bg-secondary flex-shrink-0 d-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }}>
                          <i className="bi bi-music-note text-white" style={{ fontSize: 14 }} />
                        </div>
                    }

                    {/* Info */}
                    <div className="overflow-hidden flex-grow-1">
                      <div className="text-truncate" style={{ fontSize: 13, color: isCurrent ? '#1db954' : '#fff', fontWeight: isCurrent ? 600 : 400 }}>
                        {track.title}
                      </div>
                      <div className="text-truncate text-secondary" style={{ fontSize: 11 }}>
                        {track.artist}
                      </div>
                    </div>

                    {/* Source icons */}
                    <div className="d-flex gap-1 flex-shrink-0">
                      {track.spotify_id && <i className="bi bi-spotify text-success" style={{ fontSize: 11 }} />}
                      {track.youtube_id && <i className="bi bi-youtube text-danger" style={{ fontSize: 11 }} />}
                      {track.local_path && <i className="bi bi-folder-fill text-warning" style={{ fontSize: 11 }} />}
                    </div>
                  </div>
                )
              })}

              {sliceStart + tracks.length < queue.length && (
                <div className="text-secondary small text-center py-2">
                  ↓ {queue.length - sliceStart - tracks.length} tracks below
                </div>
              )}
            </>
          ) : (
            <div className="text-secondary text-center py-5 px-3">
              <i className="bi bi-hourglass-split d-block fs-2 mb-2" />
              Loading queue…
            </div>
          )}
        </div>
      </div>

      <style>{`.queue-row:hover { background: rgba(255,255,255,0.06) !important; }`}</style>
    </>
  )
}
