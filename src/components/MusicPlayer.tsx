import { useState, useEffect, useRef, useCallback } from 'react'

interface Track {
  id: string
  url: string
  videoId: string
  title: string
}

const STORAGE_TRACKS = 'fjobhunt:music:tracks'
const STORAGE_VOLUME = 'fjobhunt:music:volume'

const DEFAULT_TRACKS: Track[] = [
  {
    id: crypto.randomUUID(),
    url: 'https://www.youtube.com/watch?v=s6oZ6LJeDws',
    videoId: 's6oZ6LJeDws',
    title: 'lo-fi chill',
  },
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
    YT: typeof YT
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

interface MusicPlayerProps {
  muted: boolean
}

export default function MusicPlayer({ muted }: MusicPlayerProps) {
  const [open, setOpen] = useState(false)
  const [tracks, setTracks] = useState<Track[]>(loadTracks)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(loadVolume)
  const [urlInput, setUrlInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const panelRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const iframeContainerRef = useRef<HTMLDivElement>(null)
  const ytReadyRef = useRef(false)

  // Persist tracks
  useEffect(() => {
    localStorage.setItem(STORAGE_TRACKS, JSON.stringify(tracks))
  }, [tracks])

  // Persist volume
  useEffect(() => {
    localStorage.setItem(STORAGE_VOLUME, String(volume))
  }, [volume])

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

  // Load YT API once
  useEffect(() => {
    loadYTApi(() => { ytReadyRef.current = true })
  }, [])

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

    playerRef.current = new window.YT.Player(div.id, {
      height: '1',
      width: '1',
      videoId,
      playerVars: { autoplay: 1, controls: 0 },
      events: {
        onReady(e) {
          e.target.setVolume(muted ? 0 : volume)
          e.target.playVideo()
          setPlaying(true)
        },
        onStateChange(e) {
          if (e.data === window.YT.PlayerState.ENDED) {
            setCurrentIdx((idx) => (idx + 1) % tracks.length)
          }
          if (e.data === window.YT.PlayerState.PLAYING) setPlaying(true)
          if (e.data === window.YT.PlayerState.PAUSED) setPlaying(false)
        },
      },
    })
  }, [muted, tracks.length]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Sync mute + volume
  useEffect(() => {
    if (!playerRef.current) return
    try { playerRef.current.setVolume(muted ? 0 : volume) } catch { /* ignore */ }
  }, [muted, volume])

  function addTrack() {
    setInputError(null)
    const videoId = extractVideoId(urlInput.trim())
    if (!videoId) { setInputError('Invalid YouTube URL'); return }
    const newTrack: Track = {
      id: crypto.randomUUID(),
      url: urlInput.trim(),
      videoId,
      title: nameInput.trim() || `Track ${tracks.length + 1}`,
    }
    setTracks((prev) => [...prev, newTrack])
    setUrlInput('')
    setNameInput('')
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
    playTrack((currentIdx + 1) % tracks.length)
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
  }

  function startEdit(t: Track) {
    setEditingId(t.id)
    setEditingName(t.title)
  }

  function commitEdit(id: string) {
    setTracks((prev) =>
      prev.map((t) => t.id === id ? { ...t, title: editingName.trim() || t.title } : t)
    )
    setEditingId(null)
  }

  const currentTrack = tracks[currentIdx] ?? null

  return (
    <div className="relative" ref={panelRef}>
      {/* YT iframe — always mounted so playback continues in background */}
      <div
        ref={iframeContainerRef}
        style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', top: 0, left: 0 }}
        aria-hidden
      />

      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`text-xs leading-none ${open || playing ? 'text-primary' : 'text-muted hover:text-primary'}`}
        title="Music player"
      >
        {playing ? '♪' : '♩'}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-8 bg-surface border border-border w-72 flex flex-col z-50 font-pixel text-xs">

          {/* Now playing */}
          <div className="px-3 py-2 border-b border-border">
            <p className="text-muted mb-1">NOW PLAYING</p>
            <p className="text-primary truncate">{currentTrack ? currentTrack.title : '—'}</p>
          </div>

          {/* Playback controls */}
          <div className="flex items-center justify-center gap-6 py-3 border-b border-border">
            <button onClick={prev} disabled={tracks.length === 0}
              className="text-muted hover:text-primary disabled:opacity-30 text-sm" title="Previous">
              ◀◀
            </button>
            <button onClick={togglePlay} disabled={tracks.length === 0}
              className="text-primary hover:text-secondary disabled:opacity-30 text-base" title={playing ? 'Pause' : 'Play'}>
              {playing ? '⏸' : '▶'}
            </button>
            <button onClick={next} disabled={tracks.length === 0}
              className="text-muted hover:text-primary disabled:opacity-30 text-sm" title="Next">
              ▶▶
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <span className="text-muted shrink-0">VOL</span>
            <input type="range" min={0} max={100} value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="flex-1 accent-primary h-1 cursor-pointer"
              title={`Volume: ${volume}%`}
            />
            <span className="text-muted w-6 text-right shrink-0">{volume}</span>
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
            <p className="text-muted">ADD TRACK</p>
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
