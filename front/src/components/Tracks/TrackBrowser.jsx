import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import TrackTable, { SEARCH_BAR_HEIGHT } from './TrackTable'

const PER_PAGE = 100

// Searchable, sortable, infinite-scroll track list. With playlistId it shows that playlist
// (default order = playlist order); otherwise the whole library.
const DOWNLOAD_FILTERS = [
  ['', 'All'],
  ['downloaded', 'Downloaded'],
  ['not_downloaded', 'Not downloaded'],
  ['queued', 'Queued'],
  ['failed', 'Failed'],
]

export default function TrackBrowser({ title, icon = 'bi-music-note-list', playlistId = null, headerLeft }) {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  // Search, sort and filters live in the URL so a refresh keeps you where you were.
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const download = searchParams.get('download') || ''
  const missingVideo = searchParams.get('missing_video') === '1'
  const sort = {
    key: searchParams.get('sort') || (playlistId ? 'position' : 'artist'),
    dir: searchParams.get('dir') || 'asc',
  }
  const setParams = useCallback((changes) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v); else next.delete(k)
      }
      return next
    }, { replace: true })
  }, [setSearchParams])
  const sentinelRef = useRef(null)
  const requestRef = useRef(0)  // ignore responses from superseded requests

  const hasMore = items.length < total

  // New query, sort or filter: start over from page 1.
  useEffect(() => { setItems([]); setTotal(0); setPage(1); setLoading(true) }, [q, sort.key, sort.dir, download, missingVideo])

  useEffect(() => {
    const id = ++requestRef.current
    const params = { q, page, per_page: PER_PAGE, sort: sort.key, dir: sort.dir }
    if (playlistId) params.playlist_id = playlistId
    if (missingVideo) params.missing_video = true
    if (download) params.download = download
    api.getTracks(params)
      .then(res => {
        if (id !== requestRef.current) return
        setItems(prev => (page === 1 ? res.items : [...prev, ...res.items]))
        setTotal(res.total)
      })
      .catch(console.error)
      .finally(() => { if (id === requestRef.current) setLoading(false) })
  }, [q, sort.key, sort.dir, page, playlistId, missingVideo, download])

  // Load the next page when the sentinel below the table scrolls into view.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !loading) {
        setLoading(true)
        setPage(p => p + 1)
      }
    }, { rootMargin: '600px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loading])

  const onTrackChange = useCallback((updated) => {
    setItems(prev => prev.map(t => (t.id === updated.id ? updated : t)))
  }, [])

  const onSort = useCallback((key) => {
    setParams(sort.key === key ? { sort: key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: 'asc' })
  }, [setParams, sort.key, sort.dir])

  return (
    <div className="card">
      <div className="card-header d-flex align-items-center gap-2">
        {headerLeft}
        <i className={`bi ${icon}`} />
        <span className="fw-semibold flex-grow-1">{title}</span>
        <span className="badge bg-secondary">{total}</span>
      </div>
      <div
        className="bg-body px-3 d-flex align-items-center"
        style={{ position: 'sticky', top: 0, zIndex: 3, height: SEARCH_BAR_HEIGHT }}
      >
        <input
          className="form-control"
          placeholder="Search title or artist..."
          value={q}
          onChange={e => setParams({ q: e.target.value })}
        />
        <select
          className="form-select ms-2" style={{ width: 'auto', flexShrink: 0 }}
          value={download} onChange={e => setParams({ download: e.target.value })}
          title="Filter by local download state"
        >
          {DOWNLOAD_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <div className="form-check form-switch mb-0 ms-3 text-nowrap flex-shrink-0">
          <input className="form-check-input" type="checkbox" id="missing-video" checked={missingVideo}
            onChange={e => setParams({ missing_video: e.target.checked ? '1' : '' })} />
          <label className="form-check-label small" htmlFor="missing-video">Missing video</label>
        </div>
      </div>
      <TrackTable
        tracks={items} loading={loading && !items.length} sort={sort} onSort={onSort}
        onTrackChange={onTrackChange} showIndex={!!playlistId}
      />
      <div ref={sentinelRef} style={{ height: 1 }} />
      {loading && items.length > 0 && (
        <div className="text-center py-3"><div className="spinner-border spinner-border-sm" /></div>
      )}
    </div>
  )
}
