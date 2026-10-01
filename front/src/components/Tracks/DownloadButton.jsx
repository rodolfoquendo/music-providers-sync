import { useEffect, useState } from 'react'
import { api } from '../../api/client'

// Queues a manual download (128 kbps mp3) and follows it until the background worker finishes.
export default function DownloadButton({ track, source, onChange, label = 'Download' }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const queued = !!track.requested_download_at && !track.downloaded_at && !track.download_error
  const failed = !!track.download_error
  const mine = track.download_source === source  // the queued/failed request belongs to this button

  // While queued, poll until the worker marks it downloaded or failed.
  useEffect(() => {
    if (!queued) return
    const timer = setInterval(async () => {
      try { onChange(await api.getTrack(track.id)) } catch (e) { console.error(e) }
    }, 4000)
    return () => clearInterval(timer)
  }, [queued, track.id, onChange])

  const request = async () => {
    setBusy(true)
    setError(null)
    try {
      onChange(await api.downloadTrack(track.id, source))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (queued && mine) {
    return (
      <button className="btn btn-sm btn-outline-secondary py-0" disabled title="Waiting for the download worker">
        <span className="spinner-border spinner-border-sm me-1" style={{ width: 12, height: 12, borderWidth: 2 }} />Queued
      </button>
    )
  }

  return (
    <>
      <button className={`btn btn-sm py-0 ${failed && mine ? 'btn-outline-danger' : 'btn-outline-primary'}`}
        onClick={request} disabled={busy || queued}
        title={failed && mine ? `Failed: ${track.download_error}` : 'Queue as mp3 128 kbps for the local library'}>
        <i className={`bi ${failed && mine ? 'bi-arrow-clockwise' : 'bi-download'} me-1`} />
        {failed && mine ? 'Retry' : label}
      </button>
      {error && <div className="text-danger small">{error}</div>}
    </>
  )
}
