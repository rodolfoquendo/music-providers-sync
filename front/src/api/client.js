const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || res.statusText)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Auth
  getSpotifyStatus: () => request('/auth/spotify/status'),
  disconnectSpotify: () => request('/auth/spotify/disconnect', { method: 'DELETE' }),
  getSpotifyToken: () => request('/spotify/token'),
  getYoutubeStatus: () => request('/youtube/status'),

  // Tracks
  getTracks: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/tracks${qs ? `?${qs}` : ''}`)
  },
  getTrackIds: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/tracks/ids${qs ? `?${qs}` : ''}`)
  },
  getTrack: (id) => request(`/tracks/${id}`),
  getTracksBatch: (ids) => request(`/tracks/batch?ids=${ids.join(',')}`),
  addFromYoutube: (url) =>
    request('/tracks/from-youtube', { method: 'POST', body: JSON.stringify({ url }) }),
  updateTrackMetadata: (id, data) =>
    request(`/tracks/${id}/metadata`, { method: 'PATCH', body: JSON.stringify(data) }),
  setYoutubeVideo: (id, youtube_video_url) =>
    request(`/tracks/${id}/youtube-video`, { method: 'PATCH', body: JSON.stringify({ youtube_video_url }) }),
  findYoutubeVideo: (id) => request(`/tracks/${id}/find-youtube-video`, { method: 'POST' }),
  downloadTrack: (id, source = 'video') =>
    request(`/tracks/${id}/download?source=${source}`, { method: 'POST' }),
  streamUrl: (id) => `${BASE}/tracks/${id}/stream`,

  // Playlists
  getPlaylists: () => request('/playlists'),
  getPlaylistTrackIds: (id) => request(`/playlists/${id}/track-ids`),
  getPlaylist: (id) => request(`/playlists/${id}`),
  getPlaylistTracks: (id, params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/playlists/${id}/tracks${qs ? `?${qs}` : ''}`)
  },
  updatePlaylist: (id, data) => request(`/playlists/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Sync
  syncFromSpotify: (playlist_ids = null) =>
    request('/sync/spotify', { method: 'POST', body: JSON.stringify({ playlist_ids }) }),
  syncToYoutube: (playlist_ids = null) =>
    request('/sync/youtube', { method: 'POST', body: JSON.stringify({ playlist_ids }) }),
  getSyncLogs: () => request('/sync/logs'),

  // Spotify device control
  getSpotifyDevices: () => request('/spotify/devices'),
  getSpotifyCurrentlyPlaying: () => request('/spotify/currently-playing'),
  transferSpotifyPlayback: (device_id, play = true) =>
    request('/spotify/transfer', { method: 'POST', body: JSON.stringify({ device_id, play }) }),

  // Local
  getLocalConfig: () => request('/local/config'),
  scanLocal: () => request('/local/scan', { method: 'POST' }),
}
