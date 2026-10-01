import { useState } from 'react'
import { api } from '../../api/client'
import { usePlayer } from '../../contexts/PlayerContext'
import YoutubeVideoEditor from './YoutubeVideoEditor'
import DownloadButton from './DownloadButton'

function formatMs(ms) {
  if (!ms) return '--'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '--')

function Row({ label, children }) {
  return (
    <tr>
      <th className="text-secondary fw-normal text-nowrap pe-3">{label}</th>
      <td className="text-break">{children ?? '--'}</td>
    </tr>
  )
}

// Title/artist/album editor, only for tracks added by hand from YouTube (no Spotify id).
function MetadataEditor({ track, onChange }) {
  const [form, setForm] = useState({ title: track.title, artist: track.artist, album: track.album || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const dirty = form.title !== track.title || form.artist !== track.artist || form.album !== (track.album || '')

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      onChange(await api.updateTrackMetadata(track.id, form))
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-3">
      {['title', 'artist', 'album'].map(k => (
        <div className="input-group input-group-sm mb-1" key={k}>
          <span className="input-group-text" style={{ width: 70 }}>{k[0].toUpperCase() + k.slice(1)}</span>
          <input className="form-control" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
        </div>
      ))}
      <button className="btn btn-sm btn-primary" onClick={save} disabled={!dirty || saving}>
        {saving ? <span className="spinner-border spinner-border-sm" /> : 'Save details'}
      </button>
      {error && <span className="text-danger small ms-2">{error}</span>}
      <div className="form-text">Names the file when you download it. Won't rename a file already downloaded.</div>
    </div>
  )
}

export default function TrackDetail({ track, onChange }) {
  const { play, pause, resume, currentTrack, playing } = usePlayer()
  const isCurrent = currentTrack?.id === track.id
  const onPlayClick = () => (isCurrent ? (playing ? pause() : resume()) : play(track))

  const downloadSource = track.youtube_video_id ? 'video' : track.youtube_id ? 'audio' : null

  const artists = Array.isArray(track.artists_json) && track.artists_json.length ? track.artists_json.join(', ') : track.artist
  const genres = Array.isArray(track.genres_json) && track.genres_json.length ? track.genres_json.join(', ') : null
  const source = track.local_path ? 'local file' : track.spotify_uri ? 'Spotify' : track.spotify_preview_url ? 'Spotify preview' : track.youtube_id ? 'YouTube' : null

  return (
    <div className="row g-3 p-3" onClick={e => e.stopPropagation()}>
      <div className="col-lg-4">
        <div className="d-flex gap-3 mb-3">
          {track.cover_url && <img src={track.cover_url} alt="" width={120} height={120} className="rounded" />}
          <div className="d-flex flex-column justify-content-center gap-2">
            <button className="btn btn-success d-flex align-items-center gap-2" onClick={onPlayClick} disabled={!source}>
              <i className={`bi ${isCurrent && playing ? 'bi-pause-fill' : 'bi-play-fill'} fs-5`} />
              {isCurrent && playing ? 'Pause' : 'Play'}
            </button>
            <div className="small text-secondary">{source ? `Plays from ${source}` : 'No playable source'}</div>
          </div>
        </div>
        {!track.spotify_id && <MetadataEditor key={`${track.title}|${track.artist}|${track.album}`} track={track} onChange={onChange} />}
        <table className="table table-sm table-borderless mb-0 small">
          <tbody>
            <Row label="Title">{track.title}{track.explicit && <span className="badge bg-secondary ms-1">E</span>}</Row>
            <Row label="Artists">{artists}</Row>
            <Row label="Album">{track.album}</Row>
            <Row label="Released">{track.release_date}</Row>
            <Row label="Duration">{formatMs(track.duration_ms)}</Row>
            <Row label="Popularity">{track.popularity}</Row>
            <Row label="Genres">{genres}</Row>
            <Row label="Spotify">
              {track.spotify_id
                ? <a href={`https://open.spotify.com/track/${track.spotify_id}`} target="_blank" rel="noreferrer">{track.spotify_id}</a>
                : null}
            </Row>
            <Row label="YT Music">
              {track.youtube_id
                ? <a href={track.youtube_url} target="_blank" rel="noreferrer">{track.youtube_id}</a>
                : null}
            </Row>
            <Row label="Added">{fmtDate(track.created_at)}</Row>
            <Row label="Updated">{fmtDate(track.updated_at)}</Row>
          </tbody>
        </table>
      </div>

      <div className="col-lg-5">
        <div className="small fw-semibold mb-2"><i className="bi bi-youtube text-danger me-1" />YouTube video</div>
        <YoutubeVideoEditor key={track.youtube_video_id} track={track} onChange={onChange} />
      </div>

      <div className="col-lg-3">
        <div className="small fw-semibold mb-2"><i className="bi bi-folder-fill text-warning me-1" />Local file</div>
        {track.local_path ? (
          <>
            <div className="small text-break">{track.local_path}</div>
            <div className="small text-secondary mt-1">
              {track.local_format?.toUpperCase()}{track.local_bitrate ? ` · ${Math.round(track.local_bitrate / 1000)} kbps` : ''}
            </div>
          </>
        ) : <div className="small text-secondary">Not downloaded.</div>}
        {downloadSource && (
          <div className="mt-2">
            <DownloadButton track={track} source={downloadSource} onChange={onChange}
              label={track.local_path ? 'Re-download' : `Download (${downloadSource})`} />
          </div>
        )}
        {track.download_error && <div className="text-danger small mt-1 text-break">Last attempt failed: {track.download_error}</div>}
        {track.downloaded_at && <div className="small text-secondary mt-1">Downloaded {fmtDate(track.downloaded_at)}</div>}
      </div>
    </div>
  )
}
