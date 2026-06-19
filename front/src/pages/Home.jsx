import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import TrackTable from '../components/Tracks/TrackTable'

export default function Home() {
  const [data, setData] = useState({ items: [], total: 0, page: 1, per_page: 50 })
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getTracks({ q, page, per_page: 50 })
      setData(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [q, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [q])

  const totalPages = Math.ceil(data.total / data.per_page)

  return (
    <div className="card">
      <div className="card-header d-flex align-items-center gap-2">
        <i className="bi bi-music-note-list" />
        <span className="fw-semibold flex-grow-1">Tracks</span>
        <span className="badge bg-secondary">{data.total}</span>
      </div>
      <div className="card-body pb-0">
        <input
          className="form-control mb-3"
          placeholder="Search title or artist..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>
      <TrackTable tracks={data.items} loading={loading} />
      {totalPages > 1 && (
        <div className="card-footer d-flex justify-content-center gap-2">
          <button className="btn btn-sm btn-outline-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            <i className="bi bi-chevron-left" />
          </button>
          <span className="align-self-center small text-secondary">Page {page} / {totalPages}</span>
          <button className="btn btn-sm btn-outline-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      )}
    </div>
  )
}
