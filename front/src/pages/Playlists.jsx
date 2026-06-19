import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import PlaylistList from '../components/Playlists/PlaylistList'

export default function Playlists() {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getPlaylists()
      setPlaylists(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="card">
      <div className="card-header d-flex align-items-center gap-2">
        <i className="bi bi-collection-fill" />
        <span className="fw-semibold flex-grow-1">Playlists</span>
        <span className="badge bg-secondary">{playlists.length}</span>
      </div>
      <div className="card-body p-0">
        <PlaylistList playlists={playlists} loading={loading} onToggle={load} />
      </div>
    </div>
  )
}
