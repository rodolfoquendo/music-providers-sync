import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import TrackBrowser from '../components/Tracks/TrackBrowser'

export default function PlaylistDetail() {
  const { id } = useParams()
  const [playlist, setPlaylist] = useState(null)

  useEffect(() => { api.getPlaylist(id).then(setPlaylist).catch(console.error) }, [id])

  return (
    <TrackBrowser
      key={id}
      title={playlist?.name || 'Playlist'}
      icon="bi-collection-fill"
      playlistId={Number(id)}
      headerLeft={<Link to="/playlists" className="btn btn-sm btn-outline-secondary"><i className="bi bi-arrow-left" /></Link>}
    />
  )
}
