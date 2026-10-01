import { useState } from 'react'
import { api } from '../../api/client'

// Embedded YouTube video of a track + an input to fix or fill its URL.
export default function YoutubeVideoEditor({ track, onChange }) {
  const [url, setUrl] = useState(track.youtube_video_url || '')
  const [saving, setSaving] = useState(false)
  const [finding, setFinding] = useState(false)
  const [error, setError] = useState(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      onChange(await api.setYoutubeVideo(track.id, url))
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const find = async () => {
    setFinding(true)
    setError(null)
    try {
      onChange(await api.findYoutubeVideo(track.id))
    } catch (e) {
      setError(e.message)
    } finally {
      setFinding(false)
    }
  }

  const dirty = url.trim() !== (track.youtube_video_url || '')

  return (
    <>
      {track.youtube_video_id ? (
        <div className="ratio ratio-16x9">
          <iframe
            key={track.youtube_video_id}
            title="YouTube video"
            src={`https://www.youtube.com/embed/${track.youtube_video_id}`}
            allow="encrypted-media; fullscreen"
            allowFullScreen
          />
        </div>
      ) : <span className="text-secondary small">No video match yet.</span>}
      <div className="input-group input-group-sm mt-2">
        <input
          className="form-control" placeholder="Paste the right YouTube URL or video id"
          value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && dirty && save()}
        />
        <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? <span className="spinner-border spinner-border-sm" /> : 'Save'}
        </button>
        <button className="btn btn-outline-secondary" onClick={find} disabled={finding || saving}
          title="Search YouTube for this track and use the top result">
          {finding
            ? <span className="spinner-border spinner-border-sm" />
            : <><i className="bi bi-search me-1" />{track.youtube_video_id ? 'Search again' : 'Find automatically'}</>}
        </button>
      </div>
      {error && <div className="text-danger small mt-1">{error}</div>}
      <div className="form-text">Empty + Save clears the match. An already downloaded file is not replaced.</div>
    </>
  )
}
