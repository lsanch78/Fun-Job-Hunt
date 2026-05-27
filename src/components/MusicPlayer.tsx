import { useState, useEffect, useRef, useCallback } from 'react'
import { playMusicBlip } from '@/lib/sfx'
import { Music } from 'pixelarticons/react'
import { supabase } from '@/lib/supabase'
import {
  fetchTracks as dbFetchTracks,
  createTrack as dbCreateTrack,
  renameTrack as dbRenameTrack,
  deleteTrack as dbDeleteTrack,
} from '@/services/musicService'

interface Track {
  id: string
  url: string
  videoId: string
  title: string
}

const STORAGE_TRACKS = 'fjobhunt:music:tracks'
const STORAGE_VOLUME = 'fjobhunt:music:volume'
const STORAGE_RESUME = 'fjobhunt:music:resume'
const STORAGE_SHUFFLE = 'fjobhunt:music:shuffle'
const MAX_TRACKS = 50 // see docs/SCALABILITY.md

interface ResumeState {
  idx: number
  seconds: number
  playing: boolean
}

function saveResume(state: ResumeState) {
  try { localStorage.setItem(STORAGE_RESUME, JSON.stringify(state)) } catch { /* ignore */ }
}

function loadResume(): ResumeState | null {
  try {
    const raw = localStorage.getItem(STORAGE_RESUME)
    if (raw) return JSON.parse(raw) as ResumeState
  } catch { /* ignore */ }
  return null
}

const DEFAULT_TRACKS: Track[] = [
  { id: crypto.randomUUID(), url: 'https://www.youtube.com/watch?v=B42X2-pHjvg', videoId: 'B42X2-pHjvg', title: 'Zelda — Zeryu Soul' },
  { id: crypto.randomUUID(), url: 'https://www.youtube.com/watch?v=2nM8kZuifeo', videoId: '2nM8kZuifeo', title: 'Fancy Fox Nintendo Mix' },
  { id: crypto.randomUUID(), url: 'https://www.youtube.com/watch?v=k4Q7LOSE88E', videoId: 'k4Q7LOSE88E', title: 'Donkey Kong Mix — Visual Escape' },
  { id: crypto.randomUUID(), url: 'https://www.youtube.com/watch?v=unhA-n8z9cQ', videoId: 'unhA-n8z9cQ', title: 'Low Poly DnB — jungle wizard' },
  { id: crypto.randomUUID(), url: 'https://www.youtube.com/watch?v=KBZnLqeYhgc', videoId: 'KBZnLqeYhgc', title: 'Runescape — Enzo OSRS' },
]

function loadTracks(): Track[] {
  try {
    const raw = localStorage.getItem(STORAGE_TRACKS)
    if (raw) {
      const parsed = JSON.parse(raw) as Track[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return DEFAULT_TRACKS
}

function loadVolume(): number {
  try {
    const raw = localStorage.getItem(STORAGE_VOLUME)
    if (raw !== null) {
      const n = Number(raw)
      if (!isNaN(n)) return Math.min(100, Math.max(0, n))
    }
  } catch { /* ignore */ }
  return 80
}

function loadShuffle(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_SHUFFLE)
    if (raw !== null) return raw === 'true'
  } catch { /* ignore */ }
  return true // on by default
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0]
    const v = u.searchParams.get('v')
    if (v) return v
    const embedMatch = u.pathname.match(/\/embed\/([^/?]+)/)
    if (embedMatch) return embedMatch[1]
  } catch { /* ignore */ }
  return null
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

let ytApiLoaded = false
let ytApiReady = false
const ytReadyCallbacks: Array<() => void> = []

function loadYTApi(onReady: () => void) {
  if (ytApiReady) { onReady(); return }
  ytReadyCallbacks.push(onReady)
  if (ytApiLoaded) return
  ytApiLoaded = true
  window.onYouTubeIframeAPIReady = () => {
    ytApiReady = true
    ytReadyCallbacks.forEach((cb) => cb())
    ytReadyCallbacks.length = 0
  }
  const tag = document.createElement('script')
  tag.src = 'https://www.youtube.com/iframe_api'
  document.head.appendChild(tag)
}


const inputCls = 'bg-bg border border-border text-primary text-xs px-2 py-1 outline-none focus:border-primary font-pixel placeholder-muted'

export default function MusicPlayer() {
  const [open, setOpen] = useState(false)
  const [tracks, setTracks] = useState<Track[]>(loadTracks)
  const [userId, setUserId] = useState<string | null>(null)
  const [currentIdx, setCurrentIdx] = useState(() => {
    const r = loadResume()
    const t = loadTracks()
    return r && r.idx < t.length ? r.idx : 0
  })
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(loadVolume)
  const [shuffle, setShuffle] = useState(loadShuffle)
  const [urlInput, setUrlInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const panelRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const iframeContainerRef = useRef<HTMLDivElement>(null)
  const ytReadyRef = useRef(false)
  // Mirrors for use in unload handler / event callbacks (avoids stale closures)
  const playingRef = useRef(false)
  const currentIdxRef = useRef(currentIdx)
  const shuffleRef = useRef(shuffle)
  const tracksRef = useRef(tracks)
  const volumeRef = useRef(volume)
  // Initialised once from storage; createPlayer consumes and clears it
  const resume = loadResume()
  const resumeSeekRef = useRef<number | null>(resume?.playing ? (resume.seconds ?? 0) : null)
  const shouldAutoStartRef = useRef<boolean>(resume?.playing ?? false)

  // On mount: resolve user, load tracks from DB if signed in
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      dbFetchTracks(user.id).then((rows) => {
        if (rows.length > 0) {
          setTracks(rows.map((r) => ({ id: r.id, url: r.url, videoId: r.videoId, title: r.title })))
        }
      })
    })
  }, [])

  // Persist tracks to localStorage (fallback for signed-out users)
  useEffect(() => {
    localStorage.setItem(STORAGE_TRACKS, JSON.stringify(tracks))
  }, [tracks])

  // Persist volume
  useEffect(() => {
    localStorage.setItem(STORAGE_VOLUME, String(volume))
  }, [volume])

  // Persist shuffle
  useEffect(() => {
    localStorage.setItem(STORAGE_SHUFFLE, String(shuffle))
  }, [shuffle])

  // Close on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // Keep refs in sync with state so callbacks never see stale values
  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => { currentIdxRef.current = currentIdx }, [currentIdx])
  useEffect(() => { shuffleRef.current = shuffle }, [shuffle])
  useEffect(() => { tracksRef.current = tracks }, [tracks])
  useEffect(() => { volumeRef.current = volume }, [volume])

  const createPlayer = useCallback((videoId: string) => {
    if (!iframeContainerRef.current) return
    if (playerRef.current) {
      try { playerRef.current.destroy() } catch { /* ignore */ }
      playerRef.current = null
    }
    const div = document.createElement('div')
    div.id = 'yt-player-' + Date.now()
    iframeContainerRef.current.innerHTML = ''
    iframeContainerRef.current.appendChild(div)

    const seekTo = resumeSeekRef.current ?? 0
    resumeSeekRef.current = null

    playerRef.current = new window.YT.Player(div.id, {
      height: '1',
      width: '1',
      videoId,
      playerVars: { autoplay: 1, controls: 0, start: Math.floor(seekTo) },
      events: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onReady(e: any) {
          e.target.setVolume(volumeRef.current)
          e.target.playVideo()
          setPlaying(true)
          playingRef.current = true
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onStateChange(e: any) {
          if (e.data === window.YT.PlayerState.ENDED) {
            const len = tracksRef.current.length
            if (len === 0) return
            setCurrentIdx((idx) => {
              if (shuffleRef.current && len > 1) {
                let next: number
                do { next = Math.floor(Math.random() * len) } while (next === idx)
                return next
              }
              return (idx + 1) % len
            })
          }
          if (e.data === window.YT.PlayerState.PLAYING) { setPlaying(true); playingRef.current = true }
          if (e.data === window.YT.PlayerState.PAUSED)  { setPlaying(false); playingRef.current = false }
        },
      },
    })
  }, [tracks.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const prevTracksLen = useRef(0)
  useEffect(() => {
    if (tracks.length === 0) return
    if (prevTracksLen.current === 0 && tracks.length === 1) {
      prevTracksLen.current = tracks.length
      return
    }
    prevTracksLen.current = tracks.length
    if (ytReadyRef.current) {
      createPlayer(tracks[currentIdx].videoId)
    }
  }, [currentIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load YT API; if we have a session to resume, kick off playback immediately
  useEffect(() => {
    loadYTApi(() => {
      ytReadyRef.current = true
      if (shouldAutoStartRef.current) {
        shouldAutoStartRef.current = false
        if (tracks[currentIdx]) createPlayer(tracks[currentIdx].videoId)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save resume state every 5s (uses refs — always current, no stale closures)
  useEffect(() => {
    const id = setInterval(() => {
      if (!playerRef.current || !playingRef.current) return
      try {
        const seconds = playerRef.current.getCurrentTime()
        saveResume({ idx: currentIdxRef.current, seconds, playing: true })
      } catch { /* ignore */ }
    }, 5_000)
    return () => clearInterval(id)
  }, [])

  // Save resume state on page unload (refs guarantee fresh values)
  useEffect(() => {
    function onUnload() {
      try {
        const seconds = playerRef.current?.getCurrentTime() ?? 0
        saveResume({ idx: currentIdxRef.current, seconds, playing: playingRef.current })
      } catch { /* ignore */ }
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  // Sync volume
  useEffect(() => {
    if (!playerRef.current) return
    try { playerRef.current.setVolume(volume) } catch { /* ignore */ }
  }, [volume])

  // Fade out on victory cutscene
  useEffect(() => {
    function handleFade() {
      if (!playerRef.current) return
      let v = volume
      const interval = setInterval(() => {
        v = Math.max(0, v - 5)
        try { playerRef.current!.setVolume(v) } catch { /* ignore */ }
        if (v === 0) {
          clearInterval(interval)
          try { playerRef.current!.pauseVideo() } catch { /* ignore */ }
        }
      }, 60)
    }
    window.addEventListener('fjobhunt:music-fade', handleFade)
    return () => window.removeEventListener('fjobhunt:music-fade', handleFade)
  }, [volume])

  function addTrack() {
    setInputError(null)
    if (tracks.length >= MAX_TRACKS) { setInputError(`Queue limit reached (${MAX_TRACKS} tracks max). Remove some tracks to add more.`); return }
    const videoId = extractVideoId(urlInput.trim())
    if (!videoId) { setInputError('Invalid YouTube URL'); return }
    const url   = urlInput.trim()
    const title = nameInput.trim() || `Track ${tracks.length + 1}`
    const tempId = crypto.randomUUID()
    setTracks((prev) => [...prev, { id: tempId, url, videoId, title }])
    setUrlInput('')
    setNameInput('')
    if (userId) {
      dbCreateTrack(userId, { url, videoId, title, position: tracks.length }).then((realId) => {
        if (realId) {
          setTracks((prev) => prev.map((t) => t.id === tempId ? { ...t, id: realId } : t))
        }
      })
    }
  }

  function playTrack(idx: number) {
    setCurrentIdx(idx)
    if (ytReadyRef.current && tracks[idx]) {
      createPlayer(tracks[idx].videoId)
    }
  }

  function togglePlay() {
    if (!playerRef.current) {
      if (tracks.length > 0 && ytReadyRef.current) createPlayer(tracks[currentIdx].videoId)
      return
    }
    try {
      if (playing) { playerRef.current.pauseVideo() }
      else { playerRef.current.playVideo() }
    } catch { /* ignore */ }
  }

  function prev() {
    if (tracks.length === 0) return
    playTrack((currentIdx - 1 + tracks.length) % tracks.length)
  }

  function next() {
    if (tracks.length === 0) return
    if (shuffle && tracks.length > 1) {
      let idx: number
      do { idx = Math.floor(Math.random() * tracks.length) } while (idx === currentIdx)
      playTrack(idx)
    } else {
      playTrack((currentIdx + 1) % tracks.length)
    }
  }

  function removeTrack(id: string) {
    setTracks((prev) => {
      const next = prev.filter((t) => t.id !== id)
      if (next.length === 0 && playerRef.current) {
        try { playerRef.current.stopVideo() } catch { /* ignore */ }
        setPlaying(false)
      }
      return next
    })
    if (userId) dbDeleteTrack(id)
  }

  function startEdit(t: Track) {
    setEditingId(t.id)
    setEditingName(t.title)
  }

  function commitEdit(id: string) {
    const title = editingName.trim()
    setTracks((prev) =>
      prev.map((t) => t.id === id ? { ...t, title: title || t.title } : t)
    )
    if (userId && title) dbRenameTrack(id, title)
    setEditingId(null)
  }

  const currentTrack = tracks[currentIdx] ?? null

  return (
    <div
      className="relative"
      ref={panelRef}
      data-tutorial="music-player"
    >
      {/* YT iframe — always mounted so playback continues in background */}
      <div
        ref={iframeContainerRef}
        style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', top: 0, left: 0 }}
        aria-hidden
      />

      {/* Music icon button — same style as avatar */}
      <button
        onClick={() => { playMusicBlip(); setOpen((o) => !o) }}
        className={`w-6 h-6 border flex items-center justify-center leading-none hover:opacity-80 ${
          playing
            ? 'bg-primary text-bg border-primary'
            : 'bg-surface text-muted border-border hover:text-primary hover:border-primary'
        }`}
        title={playing ? `Playing: ${currentTrack?.title ?? ''}` : 'Music'}
      >
        <Music className="w-4 h-4" />
      </button>

      {/* Panel — opens on hover */}
      {open && (
        <div className="absolute right-0 top-7 bg-surface border border-border w-72 flex flex-col z-50 font-pixel text-xs">

          {/* Now playing + transport */}
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-muted mb-1">NOW PLAYING</p>
              <p className="text-primary truncate">{currentTrack ? currentTrack.title : '—'}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={prev} disabled={tracks.length === 0}
                className="text-muted hover:text-primary disabled:opacity-30 px-0.5" title="Previous">◀</button>
              <button onClick={togglePlay} disabled={tracks.length === 0}
                className={`px-0.5 disabled:opacity-30 ${playing ? 'text-primary' : 'text-muted hover:text-primary'}`}
                title={playing ? 'Pause' : 'Play'}>
                {playing ? '⏸' : '▶'}
              </button>
              <button onClick={next} disabled={tracks.length === 0}
                className="text-muted hover:text-primary disabled:opacity-30 px-0.5" title="Next">▶</button>
            </div>
          </div>

          {/* Volume + Shuffle */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <span className="text-muted shrink-0">VOL</span>
            <input type="range" min={0} max={100} value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="flex-1 accent-primary h-1 cursor-pointer"
              title={`Volume: ${volume}%`}
            />
            <span className="text-muted w-6 text-right shrink-0">{volume}</span>
            <button
              onClick={() => setShuffle((s) => !s)}
              className={`shrink-0 px-1 border ${shuffle ? 'text-primary border-primary' : 'text-muted border-border hover:text-primary hover:border-primary'}`}
              title={shuffle ? 'Shuffle: ON' : 'Shuffle: OFF'}
            >
              ⇄
            </button>
          </div>

          {/* Queue */}
          {tracks.length > 0 && (
            <ul className="max-h-40 overflow-y-auto border-b border-border">
              {tracks.map((t, i) => (
                <li key={t.id} className={`flex items-center gap-1 px-3 py-1.5 ${i === currentIdx ? 'text-primary' : 'text-muted'}`}>
                  {/* Play indicator + title / inline edit */}
                  {editingId === t.id ? (
                    <input
                      className={`${inputCls} flex-1 min-w-0`}
                      value={editingName}
                      autoFocus
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => commitEdit(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit(t.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                  ) : (
                    <button className="truncate text-left flex-1 hover:text-primary" onClick={() => playTrack(i)}>
                      {i === currentIdx && playing ? '▶ ' : '  '}{t.title}
                    </button>
                  )}
                  {/* Edit pencil */}
                  <button onClick={() => startEdit(t)}
                    className="text-muted hover:text-secondary shrink-0" title="Rename">
                    ✎
                  </button>
                  {/* Remove */}
                  <button onClick={() => removeTrack(t.id)}
                    className="text-muted hover:text-red-500 shrink-0" title="Remove">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add track */}
          <div className="px-3 py-2 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-muted">ADD TRACK</p>
              <button
                onClick={() => setTracks(DEFAULT_TRACKS.map((t) => ({ ...t, id: crypto.randomUUID() })))}
                className="text-muted hover:text-primary text-[10px]"
                title="Reset to default tracks"
              >
                RESET
              </button>
            </div>
            <input
              className={`${inputCls} w-full`}
              placeholder="Track name (optional)"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTrack()}
            />
            <div className="flex gap-1">
              <input
                className={`${inputCls} flex-1 min-w-0`}
                placeholder="https://youtu.be/..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTrack()}
              />
              <button onClick={addTrack} className="text-bg bg-primary px-2 py-1 hover:opacity-80 shrink-0">
                +
              </button>
            </div>
            {inputError && <p className="text-red-500">{inputError}</p>}
          </div>

        </div>
      )}
    </div>
  )
}
