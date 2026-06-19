import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'
import { api } from '../api/client'

const PlayerContext = createContext(null)

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback }
  catch { return fallback }
}
function lsSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)) } catch {} }
function lsDel(key) { try { localStorage.removeItem(key) } catch {} }

export function PlayerProvider({ children }) {
  // Restore last-played track on mount (don't auto-play, just show it in the bar)
  const [currentTrack, setCurrentTrack] = useState(() => lsGet('music_current_track', null))
  const [playing, setPlaying] = useState(false)
  const [playerType, setPlayerType] = useState(null)

  const [shuffleMode, setShuffleMode] = useState(() => lsGet('music_shuffle', false))
  // In shuffle mode: persisted shuffled IDs. In normal mode: loaded fresh from API each time.
  const [queue, setQueue] = useState(() => lsGet('music_shuffle', false) ? lsGet('music_queue', []) : [])
  const [queueIndex, setQueueIndex] = useState(() => lsGet('music_queue_index', 0))
  const [queueOpen, setQueueOpen] = useState(false)

  const audioRef = useRef(null)
  const spotifyPlayerRef = useRef(null)
  const spotifyDeviceId = useRef(null)
  // When user transfers to an external Spotify device, we store it here so
  // subsequent next/prev calls keep playing on that device instead of the SDK.
  const activeSpotifyDeviceRef = useRef(null)
  // Stable ref so event handlers (onended, YT) always call the latest playNext
  const playNextRef = useRef(null)

  // ── On mount: always build the queue ──────────────────────────────────────
  useEffect(() => {
    if (shuffleMode) return // shuffle queue already restored from localStorage
    api.getTrackIds({ sort: 'artist' }).then(ids => {
      setQueue(ids)
      // Re-align queueIndex to the restored current track
      const saved = lsGet('music_current_track', null)
      if (saved && saved.id) {
        const idx = ids.indexOf(saved.id)
        if (idx !== -1) setQueueIndex(idx)
      }
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist state ─────────────────────────────────────────────────────────
  useEffect(() => { if (currentTrack) lsSet('music_current_track', currentTrack) }, [currentTrack])
  useEffect(() => { lsSet('music_queue_index', queueIndex) }, [queueIndex])
  useEffect(() => { lsSet('music_shuffle', shuffleMode) }, [shuffleMode])
  // Only persist queue when in shuffle mode (normal queue is always reloaded from API)
  useEffect(() => { if (shuffleMode) lsSet('music_queue', queue) }, [queue, shuffleMode])

  // ── Core play logic ───────────────────────────────────────────────────────
  const _doPlay = useCallback(async (track) => {
    setCurrentTrack(track)
    setPlaying(false)

    if (track.local_path) {
      setPlayerType('local')
      if (audioRef.current) {
        audioRef.current.src = api.streamUrl(track.id)
        await audioRef.current.play().catch(e => console.warn('[Player] local:', e))
        setPlaying(true)
      }
      return
    }

    if (track.spotify_uri && spotifyDeviceId.current) {
      // Use the externally-chosen device (TV, phone, etc.) if the user transferred there;
      // fall back to the in-browser SDK device.
      const targetDevice = activeSpotifyDeviceRef.current || spotifyDeviceId.current
      try {
        const { token } = await api.getSpotifyToken()
        const res = await fetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${targetDevice}`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ uris: [track.spotify_uri] }),
          }
        )
        if (res.ok || res.status === 204) {
          setPlayerType('spotify')
          setPlaying(true)
          return
        }
        console.warn('[Player] Spotify play failed:', res.status, '— falling through')
      } catch (e) {
        console.warn('[Player] Spotify error:', e)
      }
    }

    if (track.spotify_preview_url) {
      setPlayerType('local')
      if (audioRef.current) {
        audioRef.current.src = track.spotify_preview_url
        await audioRef.current.play().catch(e => console.warn('[Player] preview:', e))
        setPlaying(true)
      }
      return
    }

    if (track.youtube_id) {
      setPlayerType('youtube')
      setPlaying(true)
      return
    }

    console.warn('[Player] no playable source for:', track.title)
  }, [])

  // Public play: also syncs queueIndex when the track is in the queue
  const play = useCallback(async (track) => {
    const idx = queue.indexOf(track.id)
    if (idx !== -1) setQueueIndex(idx)
    await _doPlay(track)
  }, [queue, _doPlay])

  const pause = useCallback(() => {
    if (playerType === 'local' && audioRef.current) audioRef.current.pause()
    if (playerType === 'spotify' && spotifyPlayerRef.current) spotifyPlayerRef.current.pause()
    setPlaying(false)
  }, [playerType])

  const resume = useCallback(() => {
    if (playerType === 'local' && audioRef.current) audioRef.current.play()
    if (playerType === 'spotify' && spotifyPlayerRef.current) spotifyPlayerRef.current.resume()
    setPlaying(true)
  }, [playerType])

  const playNext = useCallback(async () => {
    if (!queue.length) return
    const nextIdx = (queueIndex + 1) % queue.length
    setQueueIndex(nextIdx)
    const track = await api.getTrack(queue[nextIdx]).catch(() => null)
    if (track) await _doPlay(track)
  }, [queue, queueIndex, _doPlay])

  const playPrev = useCallback(async () => {
    if (!queue.length) return
    const prevIdx = (queueIndex - 1 + queue.length) % queue.length
    setQueueIndex(prevIdx)
    const track = await api.getTrack(queue[prevIdx]).catch(() => null)
    if (track) await _doPlay(track)
  }, [queue, queueIndex, _doPlay])

  const playFromQueue = useCallback(async (index) => {
    if (index < 0 || index >= queue.length) return
    setQueueIndex(index)
    const track = await api.getTrack(queue[index]).catch(() => null)
    if (track) await _doPlay(track)
  }, [queue, _doPlay])

  const playFromPlaylist = useCallback(async (playlistId) => {
    const ids = await api.getPlaylistTrackIds(playlistId)
    if (!ids.length) return
    setShuffleMode(false)
    lsDel('music_queue')
    lsSet('music_shuffle', false)
    setQueue(ids)
    setQueueIndex(0)
    const track = await api.getTrack(ids[0]).catch(() => null)
    if (track) await _doPlay(track)
  }, [_doPlay])

  // Keep ref in sync so GlobalPlayer's event handlers never go stale
  useEffect(() => { playNextRef.current = playNext }, [playNext])

  const toggleShuffle = useCallback(async () => {
    const next = !shuffleMode
    setShuffleMode(next)
    if (next) {
      const ids = queue.length > 0 ? [...queue] : await api.getTrackIds({ sort: 'artist' }).catch(() => [])
      const shuffled = shuffleArray(ids)
      if (currentTrack) {
        const ci = shuffled.indexOf(currentTrack.id)
        if (ci > 0) { shuffled.splice(ci, 1); shuffled.unshift(currentTrack.id) }
        setQueueIndex(0)
      }
      setQueue(shuffled)
      lsSet('music_queue', shuffled)
    } else {
      const ids = await api.getTrackIds({ sort: 'artist' }).catch(() => [])
      setQueue(ids)
      lsDel('music_queue')
      if (currentTrack) {
        const idx = ids.indexOf(currentTrack.id)
        setQueueIndex(idx !== -1 ? idx : 0)
      }
    }
  }, [shuffleMode, queue, currentTrack])

  return (
    <PlayerContext.Provider value={{
      currentTrack, playing, playerType,
      shuffleMode, queue, queueIndex,
      queueOpen, setQueueOpen,
      audioRef, spotifyPlayerRef, spotifyDeviceId, activeSpotifyDeviceRef,
      playNextRef,
      play, pause, resume, playNext, playPrev, playFromQueue, playFromPlaylist, toggleShuffle,
      setPlaying, setPlayerType,
    }}>
      {children}
    </PlayerContext.Provider>
  )
}

export const usePlayer = () => useContext(PlayerContext)
