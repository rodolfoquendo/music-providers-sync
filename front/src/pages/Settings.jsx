import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function Settings() {
  const { spotify, youtube, refreshSpotify } = useAuth()
  const [localPath, setLocalPath] = useState('')
  const [logs, setLogs] = useState([])

  useEffect(() => {
    api.getLocalConfig().then(r => setLocalPath(r.music_local_path)).catch(() => {})
    api.getSyncLogs().then(setLogs).catch(() => {})
  }, [])

  const handleDisconnectSpotify = async () => {
    await api.disconnectSpotify()
    refreshSpotify()
  }

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <div className="card">
          <div className="card-header fw-semibold"><i className="bi bi-spotify me-2" />Spotify</div>
          <div className="card-body">
            {spotify.loading ? (
              <div className="spinner-border spinner-border-sm" />
            ) : spotify.connected ? (
              <div>
                <p className="mb-1">
                  <i className="bi bi-check-circle-fill text-success me-2" />
                  Connected as <strong>{spotify.user?.display_name || spotify.user?.id}</strong>
                </p>
                <p className="small text-secondary mb-3">
                  Spotify Web Playback SDK requires a <strong>Spotify Premium</strong> account.
                </p>
                <button className="btn btn-outline-danger btn-sm" onClick={handleDisconnectSpotify}>
                  Disconnect
                </button>
              </div>
            ) : (
              <div>
                <p className="text-secondary mb-3">Not connected.</p>
                <a href="/api/auth/spotify/login" className="btn btn-success btn-sm">
                  <i className="bi bi-spotify me-2" />Connect Spotify
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="card mt-3">
          <div className="card-header fw-semibold"><i className="bi bi-youtube me-2" />YouTube Music</div>
          <div className="card-body">
            {youtube.loading ? (
              <div className="spinner-border spinner-border-sm" />
            ) : youtube.connected ? (
              <p><i className="bi bi-check-circle-fill text-success me-2" />Connected</p>
            ) : (
              <div>
                <p className="text-secondary mb-2">Not connected. One-time setup required:</p>
                <ol className="small text-secondary">
                  <li>Run <code>pip install ytmusicapi</code> and then <code>ytmusicapi setup</code> inside the API container</li>
                  <li>Follow the prompts — paste your browser request headers from a logged-in YouTube Music session</li>
                  <li>Save the output as <code>api/ytmusic_auth.json</code> and restart the container</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-md-6">
        <div className="card">
          <div className="card-header fw-semibold"><i className="bi bi-folder-fill me-2" />Local Music Folder</div>
          <div className="card-body">
            <p className="small text-secondary">
              Configured via <code>MUSIC_LOCAL_PATH</code> in your <code>.env</code> file.
            </p>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-folder" /></span>
              <input className="form-control" value={localPath} readOnly />
            </div>
          </div>
        </div>

        <div className="card mt-3">
          <div className="card-header fw-semibold"><i className="bi bi-clock-history me-2" />Recent Sync Logs</div>
          <div className="list-group list-group-flush">
            {logs.length === 0 && <div className="list-group-item text-secondary small">No logs yet.</div>}
            {logs.map(log => (
              <div key={log.id} className="list-group-item small">
                <div className="d-flex justify-content-between">
                  <span className="fw-semibold">{log.direction.replace('_', ' ')}</span>
                  <span className={`badge ${log.status === 'success' ? 'bg-success' : log.status === 'failed' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                    {log.status}
                  </span>
                </div>
                {log.stats && (
                  <div className="text-secondary mt-1">
                    {log.stats.found ?? 0} found · {log.stats.added ?? 0} added · {log.stats.skipped ?? 0} skipped
                  </div>
                )}
                {log.error_message && <div className="text-danger mt-1">{log.error_message}</div>}
                <div className="text-secondary">{log.started_at ? new Date(log.started_at).toLocaleString() : ''}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
