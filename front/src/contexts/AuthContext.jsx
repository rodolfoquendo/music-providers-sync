import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [spotify, setSpotify] = useState({ connected: false, user: null, loading: true })
  const [youtube, setYoutube] = useState({ connected: false, loading: true })

  const refreshSpotify = async () => {
    try {
      const status = await api.getSpotifyStatus()
      setSpotify({ ...status, loading: false })
    } catch {
      setSpotify({ connected: false, user: null, loading: false })
    }
  }

  const refreshYoutube = async () => {
    try {
      const status = await api.getYoutubeStatus()
      setYoutube({ ...status, loading: false })
    } catch {
      setYoutube({ connected: false, loading: false })
    }
  }

  useEffect(() => {
    refreshSpotify()
    refreshYoutube()
    // Check if we just returned from Spotify OAuth
    const params = new URLSearchParams(window.location.search)
    if (params.get('spotify') === 'connected') {
      window.history.replaceState({}, '', window.location.pathname)
      refreshSpotify()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ spotify, youtube, refreshSpotify, refreshYoutube }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
