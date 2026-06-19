import { useEffect, useRef, useState, useCallback } from 'react'
import { usePlayer } from '../../contexts/PlayerContext'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../api/client'
import QueueDrawer from './QueueDrawer'
import DevicePicker from './DevicePicker'

function formatMs(ms) {
  if (!ms && ms !== 0) return '0:00'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function GlobalPlayer() {
  const { currentTrack, playing, playerType, shuffleMode, queue, queueIndex,
          queueOpen, setQueueOpen,
          audioRef, spotifyPlayerRef, spotifyDeviceId, activeSpotifyDeviceRef,
          playNextRef,
          pause, resume, playNext, playPrev, toggleShuffle, setPlaying } = usePlayer()
  const { spotify } = useAuth()

  const ytPlayerRef = useRef(null)
  const ytContainerRef = useRef(null)
  const pollRef = useRef(null)

  const [position, setPosition] = useState(0)   // ms
  const [duration, setDuration] = useState(0)   // ms
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [seeking, setSeeking] = useState(false)
  const [seekValue, setSeekValue] = useState(0)
  const [devicePickerOpen, setDevicePickerOpen] = useState(false)

  // ── Spotify SDK init ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!spotify.connected) return
    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: 'Music Sync Player',
        getOAuthToken: async cb => {
          const { token } = await api.getSpotifyToken().catch(() => ({ token: null }))
          if (token) cb(token)
        },
        volume,
      })
      player.addListener('ready', ({ device_id }) => {
        spotifyDeviceId.current = device_id
        console.log('[Spotify SDK] ready, device_id:', device_id)
      })
      player.addListener('not_ready', () => { spotifyDeviceId.current = null })
      player.addListener('player_state_changed', state => {
        if (!state) return
        setPlaying(!state.paused)
        setPosition(state.position)
        setDuration(state.duration)
      })
      player.addListener('initialization_error', ({ message }) => console.error('[Spotify SDK] init:', message))
      player.addListener('authentication_error', ({ message }) => console.error('[Spotify SDK] auth:', message))
      player.addListener('account_error', ({ message }) => console.error('[Spotify SDK] account (Premium required?):', message))
      player.connect().then(ok => console.log('[Spotify SDK] connect:', ok ? 'ok' : 'failed'))
      spotifyPlayerRef.current = player
    }
    if (!document.getElementById('spotify-sdk')) {
      const script = document.createElement('script')
      script.id = 'spotify-sdk'
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      document.head.appendChild(script)
    } else if (window.Spotify) {
      window.onSpotifyWebPlaybackSDKReady()
    }
  }, [spotify.connected])

  // ── YouTube iframe init ───────────────────────────────────────────────────
  useEffect(() => {
    if (playerType !== 'youtube' || !currentTrack?.youtube_id) return
    function initYT() {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.loadVideoById(currentTrack.youtube_id)
        return
      }
      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        height: '0', width: '0',
        videoId: currentTrack.youtube_id,
        playerVars: { autoplay: 1 },
        events: {
          onStateChange: e => {
            setPlaying(e.data === window.YT.PlayerState.PLAYING)
            if (e.data === window.YT.PlayerState.ENDED) playNextRef.current?.()
          },
          onReady: e => {
            e.target.setVolume(Math.round(volume * 100))
            setDuration((e.target.getDuration() || 0) * 1000)
          },
        },
      })
    }
    if (typeof window.YT === 'undefined') {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
      window.onYouTubeIframeAPIReady = initYT
    } else {
      initYT()
    }
  }, [playerType, currentTrack?.youtube_id])

  // ── Position polling (Spotify + YouTube) ──────────────────────────────────
  useEffect(() => {
    clearInterval(pollRef.current)
    if (!playing) return

    if (playerType === 'spotify' && spotifyPlayerRef.current) {
      pollRef.current = setInterval(async () => {
        if (seeking) return
        const state = await spotifyPlayerRef.current.getCurrentState()
        if (state) {
          setPosition(state.position)
          setDuration(state.duration)
        }
      }, 500)
    }

    if (playerType === 'youtube' && ytPlayerRef.current) {
      pollRef.current = setInterval(() => {
        if (seeking) return
        const yt = ytPlayerRef.current
        if (yt?.getCurrentTime) {
          setPosition(yt.getCurrentTime() * 1000)
          setDuration((yt.getDuration() || 0) * 1000)
        }
      }, 500)
    }

    return () => clearInterval(pollRef.current)
  }, [playing, playerType, seeking])

  // ── HTML5 audio events ────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => { if (!seeking) setPosition(audio.currentTime * 1000) }
    const onDuration = () => setDuration((audio.duration || 0) * 1000)
    const onEnded = () => { setPosition(0); playNextRef.current?.() }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('ended', onEnded)
    }
  }, [seeking])

  // Reset position when track changes
  useEffect(() => { setPosition(0); setDuration(currentTrack?.duration_ms || 0) }, [currentTrack?.id])

  // ── Seek ──────────────────────────────────────────────────────────────────
  const onSeekStart = () => setSeeking(true)
  const onSeekChange = e => setSeekValue(Number(e.target.value))
  const onSeekEnd = useCallback(async e => {
    const ms = Number(e.target.value)
    setPosition(ms)
    setSeeking(false)
    if (playerType === 'local' && audioRef.current) {
      audioRef.current.currentTime = ms / 1000
    } else if (playerType === 'spotify' && spotifyPlayerRef.current) {
      await spotifyPlayerRef.current.seek(ms)
    } else if (playerType === 'youtube' && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(ms / 1000, true)
    }
  }, [playerType])

  // ── Volume ────────────────────────────────────────────────────────────────
  const applyVolume = useCallback(v => {
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
    if (spotifyPlayerRef.current) spotifyPlayerRef.current.setVolume(v)
    if (ytPlayerRef.current?.setVolume) ytPlayerRef.current.setVolume(Math.round(v * 100))
  }, [])

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    if (audioRef.current) audioRef.current.muted = next
    if (spotifyPlayerRef.current) spotifyPlayerRef.current.setVolume(next ? 0 : volume)
    if (ytPlayerRef.current) next ? ytPlayerRef.current.mute() : ytPlayerRef.current.unMute()
  }

  if (!currentTrack) return <QueueDrawer />



  const progressPct = duration > 0 ? (position / duration) * 100 : 0
  const displayPosition = seeking ? seekValue : position
  const sourceIcon = playerType === 'spotify' ? 'bi-spotify' : playerType === 'youtube' ? 'bi-youtube' : 'bi-music-note-beamed'
  const volIcon = muted || volume === 0 ? 'bi-volume-mute-fill' : volume < 0.5 ? 'bi-volume-down-fill' : 'bi-volume-up-fill'

  return (
    <>
    <QueueDrawer />
    <div className="fixed-bottom bg-dark text-white border-top border-secondary" style={{ zIndex: 1050 }}>
      <audio ref={audioRef} />
      <div ref={ytContainerRef} style={{ display: 'none' }} />

      {/* Progress bar — full width strip at top of player */}
      <div style={{ position: 'relative', height: 3, background: '#444', cursor: 'pointer' }}>
        <div style={{ width: `${progressPct}%`, height: '100%', background: '#1db954', transition: seeking ? 'none' : 'width 0.5s linear' }} />
        <input
          type="range" min={0} max={duration || 1} value={seeking ? seekValue : position} step={500}
          onMouseDown={onSeekStart} onTouchStart={onSeekStart}
          onChange={onSeekChange}
          onMouseUp={onSeekEnd} onTouchEnd={onSeekEnd}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', margin: 0 }}
        />
      </div>

      <div className="container-fluid d-flex align-items-center gap-3 py-2 px-3">
        {/* Left: cover + info */}
        <div className="d-flex align-items-center gap-2" style={{ width: 220, minWidth: 0 }}>
          {currentTrack.cover_url
            ? <img src={currentTrack.cover_url} alt="" width={44} height={44} className="rounded flex-shrink-0" />
            : <div className="rounded bg-secondary d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 44, height: 44 }}>
                <i className="bi bi-music-note" />
              </div>
          }
          <div className="overflow-hidden">
            <div className="fw-semibold text-truncate" style={{ fontSize: 13 }}>{currentTrack.title}</div>
            <div className="text-secondary text-truncate" style={{ fontSize: 12 }}>{currentTrack.artist}</div>
          </div>
        </div>

        {/* Center: controls + timestamps */}
        <div className="flex-grow-1 d-flex align-items-center justify-content-center gap-2">
          {/* Shuffle */}
          <button
            className="btn btn-link p-0 d-flex align-items-center"
            onClick={toggleShuffle}
            title={shuffleMode ? `Shuffle on · ${queue.length} tracks` : 'Shuffle off'}
            style={{ color: shuffleMode ? '#1db954' : '#aaa', fontSize: 15 }}
          >
            <i className="bi bi-shuffle" />
          </button>

          {/* Prev */}
          <button
            className="btn btn-link p-0 d-flex align-items-center text-secondary"
            onClick={playPrev}
            disabled={!queue.length}
            style={{ fontSize: 18 }}
          >
            <i className="bi bi-skip-start-fill" />
          </button>

          {/* Play / Pause */}
          <span className="text-secondary" style={{ fontSize: 12, minWidth: 36, textAlign: 'right' }}>
            {formatMs(displayPosition)}
          </span>
          <button
            className="btn btn-light btn-sm rounded-circle d-flex align-items-center justify-content-center"
            style={{ width: 38, height: 38 }}
            onClick={playing ? pause : resume}
          >
            <i className={`bi ${playing ? 'bi-pause-fill' : 'bi-play-fill'}`} style={{ fontSize: 16 }} />
          </button>
          <span className="text-secondary" style={{ fontSize: 12, minWidth: 36 }}>
            {formatMs(duration || currentTrack.duration_ms)}
          </span>

          {/* Next */}
          <button
            className="btn btn-link p-0 d-flex align-items-center text-secondary"
            onClick={playNext}
            disabled={!queue.length}
            style={{ fontSize: 18 }}
          >
            <i className="bi bi-skip-end-fill" />
          </button>
        </div>

        {/* Right: volume + queue toggle + source */}
        <div className="d-flex align-items-center gap-2" style={{ width: 210, justifyContent: 'flex-end' }}>
          <button className="btn btn-link text-secondary p-0" onClick={toggleMute} style={{ fontSize: 16 }}>
            <i className={`bi ${volIcon}`} />
          </button>
          <input
            type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume}
            onChange={e => applyVolume(Number(e.target.value))}
            style={{ width: 80, accentColor: '#1db954', cursor: 'pointer' }}
          />
          <button
            className="btn btn-link p-0 position-relative"
            onClick={() => setQueueOpen(o => !o)}
            title="Play queue"
            style={{ color: queueOpen ? '#1db954' : '#aaa', fontSize: 16 }}
          >
            <i className="bi bi-music-note-list" />
            {queue.length > 0 && (
              <span
                className="position-absolute top-0 start-100 translate-middle badge rounded-pill"
                style={{ fontSize: 9, background: '#1db954', color: '#000', padding: '2px 4px' }}
              >
                {queueIndex + 1}/{queue.length}
              </span>
            )}
          </button>
          <i className={`bi ${sourceIcon} text-secondary`} style={{ fontSize: 14 }} title={playerType} />

          {/* Spotify device picker — only when Spotify is connected */}
          {spotify.connected && (
            <div className="position-relative">
              <button
                className="btn btn-link p-0"
                onClick={() => setDevicePickerOpen(o => !o)}
                title={activeSpotifyDeviceRef.current ? 'Playing on external device — click to switch' : 'Spotify devices'}
                style={{ color: devicePickerOpen || activeSpotifyDeviceRef.current ? '#1db954' : '#aaa', fontSize: 15 }}
              >
                <i className={`bi ${activeSpotifyDeviceRef.current ? 'bi-cast' : 'bi-laptop'}`} />
              </button>
              {devicePickerOpen && (
                <DevicePicker
                  onClose={() => setDevicePickerOpen(false)}
                  currentDeviceId={spotifyDeviceId.current}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
