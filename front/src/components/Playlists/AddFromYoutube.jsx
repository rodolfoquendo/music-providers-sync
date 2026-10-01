import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'

// Adds a YouTube video as a track in the local-only "YouTube" playlist.
export default function AddFromYoutube({ onAdded }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [added, setAdded] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setBusy(true)
    setError(null)
    setAdded(null)
    try {
      setAdded(await api.addFromYoutube(url))
      setUrl('')
      onAdded?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mb-3">
      <div className="card-body">
        <form className="input-group" onSubmit={submit}>
          <span className="input-group-text"><i className="bi bi-youtube text-danger" /></span>
          <input
            className="form-control" placeholder="Add from YouTube: paste a video URL"
            value={url} onChange={e => setUrl(e.target.value)} disabled={busy}
          />
          <button className="btn btn-primary" disabled={busy || !url.trim()}>
            {busy ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-plus-lg me-1" />Add</>}
          </button>
        </form>
        {error && <div className="text-danger small mt-2">{error}</div>}
        {added && (
          <div className="text-success small mt-2">
            {added.existing ? 'Already in your library, linked: ' : 'Added: '}
            <strong>{added.track.artist} — {added.track.title}</strong>.{' '}
            <Link to={`/playlists/${added.playlist_id}`}>Open playlist</Link>
          </div>
        )}
        <div className="form-text">Goes to the "YouTube" playlist. It is never synced to Spotify.</div>
      </div>
    </div>
  )
}
