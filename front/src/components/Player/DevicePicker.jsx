import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { usePlayer } from '../../contexts/PlayerContext'

const DEVICE_ICON = {
  Computer: 'bi-laptop',
  Smartphone: 'bi-phone',
  Speaker: 'bi-speaker',
  TV: 'bi-tv',
  CastAudio: 'bi-cast',
  GameConsole: 'bi-controller',
}

export default function DevicePicker({ onClose, currentDeviceId }) {
  const { activeSpotifyDeviceRef, spotifyDeviceId } = usePlayer()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [transferring, setTransferring] = useState(null)

  useEffect(() => {
    api.getSpotifyDevices()
      .then(data => setDevices(data.devices || []))
      .catch(() => setDevices([]))
      .finally(() => setLoading(false))
  }, [])

  const handleTransfer = async (device) => {
    if (transferring) return
    setTransferring(device.id)
    try {
      await api.transferSpotifyPlayback(device.id, true)
      // Track which device is now "active" so next/prev calls target it.
      // If the user picks the SDK device itself, clear the override so SDK handles it locally.
      activeSpotifyDeviceRef.current = device.id === spotifyDeviceId.current ? null : device.id
      onClose()
    } catch (e) {
      console.error('[DevicePicker] transfer failed:', e)
    } finally {
      setTransferring(null)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1059 }} />

      {/* Popover */}
      <div style={{
        position: 'absolute', bottom: '100%', right: 0, marginBottom: 8,
        background: '#282828', border: '1px solid #444', borderRadius: 8,
        minWidth: 240, zIndex: 1060, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        padding: '8px 0',
      }}>
        <div className="px-3 py-1 d-flex align-items-center justify-content-between">
          <span className="small fw-semibold text-white">
            <i className="bi bi-spotify text-success me-1" />
            Spotify Devices
          </span>
          <button className="btn btn-link text-secondary p-0" onClick={onClose} style={{ fontSize: 12 }}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <hr className="my-1 border-secondary" />

        {loading ? (
          <div className="text-center py-3">
            <div className="spinner-border spinner-border-sm text-secondary" />
          </div>
        ) : devices.length === 0 ? (
          <div className="text-secondary small text-center px-3 py-2">No active devices found.</div>
        ) : (
          devices.map(device => {
            const isCurrent = device.id === currentDeviceId
            const isActive = device.is_active
            const icon = DEVICE_ICON[device.type] || 'bi-device-hdd'
            return (
              <button
                key={device.id}
                className="w-100 text-start px-3 py-2 border-0 d-flex align-items-center gap-2"
                style={{
                  background: 'transparent',
                  color: isCurrent ? '#1db954' : isActive ? '#fff' : '#aaa',
                  cursor: isCurrent ? 'default' : 'pointer',
                  transition: 'background 0.1s',
                }}
                onClick={() => !isCurrent && handleTransfer(device)}
                disabled={transferring === device.id}
                onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                {transferring === device.id
                  ? <span className="spinner-border spinner-border-sm" style={{ width: 16, height: 16, borderWidth: 2, flexShrink: 0 }} />
                  : <i className={`bi ${icon} flex-shrink-0`} style={{ fontSize: 16 }} />
                }
                <div className="overflow-hidden">
                  <div className="text-truncate" style={{ fontSize: 13 }}>
                    {device.name}
                    {isCurrent && <span className="ms-1 text-success" style={{ fontSize: 10 }}>● this app</span>}
                    {isActive && !isCurrent && <span className="ms-1 text-secondary" style={{ fontSize: 10 }}>● active</span>}
                  </div>
                  <div className="text-secondary text-truncate" style={{ fontSize: 11 }}>
                    {device.type}{device.volume_percent != null ? ` · ${device.volume_percent}%` : ''}
                  </div>
                </div>
              </button>
            )
          })
        )}

        <hr className="my-1 border-secondary" />
        <div className="px-3 py-1 text-secondary" style={{ fontSize: 11 }}>
          Click a device to transfer Spotify playback there.
        </div>
      </div>
    </>
  )
}
