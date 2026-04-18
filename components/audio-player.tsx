"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  Search,
  Shuffle,
  Repeat,
  Repeat1,
  Sun,
  Moon,
  Loader2,
  Music2,
  X,
  ListMusic,
  Mic2,
  MoreVertical,
  Info,
  Heart,
  ChevronDown,
  ChevronUp,
  Settings,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Song {
  videoId: string
  title: string
  artist: string
  album: string
  duration: number
  thumbnail: string
}

interface LyricLine {
  time: number
  text: string
}

interface LyricsData {
  syncedLyrics: LyricLine[] | null
  plainLyrics: string | null
}

export function AudioPlayer() {
  const [isDark, setIsDark] = useState(true) // Native app default
  const[isAnimatedBg, setIsAnimatedBg] = useState(true) // BG animation toggle 

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Song[]>([])
  const[isSearching, setIsSearching] = useState(false)
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [queue, setQueue] = useState<Song[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off")
  const[isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lyrics, setLyrics] = useState<LyricsData | null>(null)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1)
  const [showLyrics, setShowLyrics] = useState(false) // Toggle true sets full lyrics view inside layout logic 
  const[audioUrl, setAudioUrl] = useState<string | null>(null)
  const [showAboutDialog, setShowAboutDialog] = useState(false)
  const [showCreditsDialog, setShowCreditsDialog] = useState(false)
  const[likedSongs, setLikedSongs] = useState<Set<string>>(new Set())
  const [searchFocused, setSearchFocused] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const currentSong = queue[currentIndex]

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
  },[isDark])

  // Safely close the top overlay
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  },[])

  // Smart querying 
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!searchQuery.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/music/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await response.json()
        setSearchResults(data.results ||[])
      } catch (error) {
        console.error("Search failed:", error)
      } finally {
        setIsSearching(false)
      }
    }, 450)

    return () => clearTimeout(searchTimeoutRef.current!)
  }, [searchQuery])

  const addToQueueAndPlay = async (song: Song) => {
    const existingIndex = queue.findIndex((s) => s.videoId === song.videoId)
    if (existingIndex >= 0) {
      setCurrentIndex(existingIndex)
    } else {
      setQueue((prev) => [...prev, song])
      setCurrentIndex(queue.length)
    }
    setSearchFocused(false)
    setSearchQuery("")
    setSearchResults([])
    setIsSearchExpanded(false)
  }

  // Prevent fetch race crashes natively
  useEffect(() => {
    if (!currentSong) return

    const ac = new AbortController()

    const loadStream = async () => {
      setIsLoading(true)
      setIsPlaying(false) // Disable interaction briefly preventing logic collisions
      setAudioUrl(null)
      setLoadError(null)

      try {
        const response = await fetch(`/api/music/stream/${currentSong.videoId}`, { signal: ac.signal })
        const data = await response.json()

        if (ac.signal.aborted) return 
        if (data.error) {
          setLoadError(data.error)
          return
        }

        if (data.audioUrl) {
          setAudioUrl(data.audioUrl)
        } else {
          setLoadError("No playable streaming source extracted. Restricted audio file.")
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Failed to load stream:", error)
          setLoadError("Stream load aborted.")
        }
      } finally {
        if(!ac.signal.aborted) setIsLoading(false)
      }
    }

    loadStream()
    return () => ac.abort()
  }, [currentSong?.videoId])

  useEffect(() => {
    if (!currentSong) return
    const ac = new AbortController();

    const loadLyrics = async () => {
      setLyrics(null)
      setCurrentLyricIndex(-1)
      try {
        const params = new URLSearchParams({
          track: currentSong.title,
          artist: currentSong.artist,
          ...(currentSong.album && { album: currentSong.album }),
          ...(currentSong.duration && { duration: String(currentSong.duration) }),
        })
        const response = await fetch(`/api/lyrics?${params}`, { signal: ac.signal })
        const data = await response.json()

        if (!ac.signal.aborted && (data.syncedLyrics || data.plainLyrics)) {
          setLyrics({
            syncedLyrics: data.syncedLyrics,
            plainLyrics: data.plainLyrics,
          })
        }
      } catch {}
    }
    loadLyrics()
    return () => ac.abort()
  }, [currentSong?.videoId])

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl
      audioRef.current.load()
      // Fix fast skipping unhandled Rejections:
      const startPromise = audioRef.current.play();
      if(startPromise !== undefined) {
        startPromise.then(() => setIsPlaying(true)).catch((e) => { 
          if(e.name !== 'AbortError') console.error(e) 
        })
      }
    }
  }, [audioUrl])

  useEffect(() => {
    if (!lyrics?.syncedLyrics) return
    const lyric = lyrics.syncedLyrics.findLast((l) => l.time <= currentTime)
    const index = lyric ? lyrics.syncedLyrics.indexOf(lyric) : -1

    if (index !== currentLyricIndex) {
      setCurrentLyricIndex(index)
      if (lyricsContainerRef.current && index >= 0) {
        const lyricElements = lyricsContainerRef.current.querySelectorAll(".lyric-line")
        lyricElements[index]?.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }
  },[currentTime, lyrics, currentLyricIndex])

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime)
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration)
  }

  const playNext = useCallback(() => {
    if (queue.length <= 1) return

    let nextIndex: number
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length)
      if(nextIndex === currentIndex) nextIndex = (nextIndex + 1) % queue.length 
    } else {
      nextIndex = (currentIndex + 1) % queue.length
    }

    if (nextIndex === 0 && repeatMode === "off" && !shuffle) {
      setIsPlaying(false)
      return
    }

    setCurrentIndex(nextIndex)
  }, [queue.length, currentIndex, shuffle, repeatMode])
  
  const handleEnded = () => {
    if (repeatMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(console.error)
      }
    } else {
      playNext()
    }
  }

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !audioUrl) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error)
    }
  }, [isPlaying, audioUrl])


  const playPrevious = useCallback(() => {
    if (queue.length === 0) return

    if (currentTime > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0
      return
    }

    const prevIndex = (currentIndex - 1 + queue.length) % queue.length
    setCurrentIndex(prevIndex)
  }, [queue.length, currentIndex, currentTime])

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
    if (audioRef.current) audioRef.current.volume = newVolume / 100
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? volume / 100 : 0
    }
  }

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index))
    if (index < currentIndex) {
      setCurrentIndex((prev) => prev - 1)
    } else if (index === currentIndex && queue.length > 1) {
      if (index === queue.length - 1) setCurrentIndex((prev) => prev - 1)
    }
  }

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2
  const showSearchDropdown = searchFocused && (searchResults.length > 0 || isSearching)

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background/95 transition-colors duration-500 max-h-[100dvh]">
      
      {/* Absolute Geometric Animated Bloom Layers tied cleanly into Z-[0] beneath App Frame natively */}
      {isAnimatedBg && (
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-[0.25] transition-opacity dark:opacity-15">
            <div className="m3-bg-shape-1 absolute top-[5%] left-[20%] h-[55vh] w-[55vh] rounded-[45%] bg-[var(--ganvo-blue)]/50 blur-[90px] filter dark:bg-[var(--ganvo-blue)]/70" />
            <div className="m3-bg-shape-2 absolute bottom-[20%] right-[10%] h-[50vh] w-[50vh] rounded-full bg-[var(--ganvo-red)]/50 blur-[100px] filter dark:bg-[var(--ganvo-red)]/80" />
            <div className="m3-bg-shape-3 absolute top-[30%] right-[35%] h-[40vh] w-[40vh] rounded-[40%] bg-[var(--ganvo-green)]/40 blur-[85px] filter dark:bg-[var(--ganvo-green)]/70" />
          </div>
      )}

      {/* Main app relative Z position allowing hits natively protecting underlying bounds correctly natively seamlessly! */}
      <div className="flex h-full w-full z-10 flex-col absolute inset-0 backdrop-blur-2xl xl:backdrop-blur-3xl">

        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />

        {/* Dynamic header ensuring it sticks strictly inside the 16 sizing and prevents drops logic failures safely! */}
        <header className="elevation-1 flex-shrink-0 z-40 flex h-16 w-full items-center justify-between px-3 md:px-6 transition-all duration-300">
          <div className="flex items-center gap-2">
            <div className="m3-transition flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ganvo-red)] transition-transform hover:scale-110 hover:rotate-3">
              <Music2 className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:flex items-baseline gap-1">
              <span className="text-xl font-normal text-muted-foreground tracking-wide">Ganvo</span>
              <span className="text-xl font-medium tracking-tight">Music</span>
            </div>
          </div>

          <div ref={searchContainerRef} className="relative flex flex-1 max-w-[65vw] mx-2 sm:mx-6 md:max-w-xl">
            <div className="w-full flex items-center relative z-[60]">
              <Search className="absolute left-3.5 h-[1.1rem] w-[1.1rem] sm:h-5 sm:w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search favorite songs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                className={cn(
                  "h-10 sm:h-11 w-full rounded-full border-0 bg-black/10 dark:bg-white/10 pl-10 sm:pl-11 pr-12 text-sm sm:text-base transition-all duration-200 focus-visible:ring-0",
                  searchFocused && "bg-card shadow-lg ring-[3px] ring-primary/80 !opacity-100"
                )}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setSearchQuery(""); setSearchResults([]) }}
                  className="absolute right-2 h-7 w-7 rounded-full text-foreground/80 hover:text-red-500 transition-colors"
                >
                  <X className="h-[1.15rem] w-[1.15rem]" />
                </Button>
              )}
            </div>

            {/* Smart Screen Constraint Logic on Overlays ensuring exact native non expanding pancaking fixed placements resolving click failures entirely effectively.  */}
            {showSearchDropdown && (
              <div 
                className={cn(
                  "elevation-4 fixed top-[60px] left-2 right-2 rounded-2xl md:absolute md:top-full md:-left-2 md:-right-2 mt-2 bg-card border shadow-xl z-50 overflow-hidden flex flex-col transition-all ease-in-out dropdown-in",
                  isSearchExpanded ? "h-[70dvh] md:max-h-[60vh]" : "max-h-[50dvh] md:max-h-[420px]"
                )}
              >
                <div className="flex-1 overflow-y-auto w-full overscroll-contain">
                  <div className="p-2 space-y-1">
                    {isSearching && searchResults.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 opacity-70">
                        <Loader2 className="h-6 w-6 animate-spin text-primary mb-3" />
                        <span className="text-sm font-medium">Looking for streams...</span>
                      </div>
                    ) : (
                      searchResults.slice(0, isSearchExpanded ? undefined : 6).map((song, index) => (
                        <button
                          key={song.videoId + index}
                          onPointerDown={(e) => {
                            e.preventDefault(); e.stopPropagation();
                            addToQueueAndPlay(song);
                          }}
                          className="w-full text-left m3-transition flex items-center gap-4 rounded-[12px] p-2 hover:bg-black/10 dark:hover:bg-white/10 focus-visible:bg-black/10 focus:outline-none"
                        >
                          <img
                            src={song.thumbnail}
                            alt=""
                            className="h-[52px] w-[52px] flex-shrink-0 rounded-[8px] object-cover border"
                          />
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="truncate text-sm font-medium">{song.title}</p>
                            <p className="truncate text-xs opacity-75">{song.artist}</p>
                          </div>
                          <span className="text-[11px] tabular-nums font-mono opacity-50 pr-2">{formatTime(song.duration)}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {searchResults.length > 6 && (
                  <div className="relative z-50 flex-shrink-0 w-full border-t border-black/5 dark:border-white/5 bg-card/95 backdrop-blur-sm p-1.5 shadow-[0_-8px_20px_-8px_rgba(0,0,0,0.1)]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onPointerDown={(e) => {
                        e.preventDefault()
                        setIsSearchExpanded(!isSearchExpanded)
                      }}
                      className="w-full justify-center gap-1.5 h-10 font-semibold tracking-wide bg-primary/5 hover:bg-primary/20 hover:text-primary transition-all text-[13px]"
                    >
                      {isSearchExpanded ? <><ChevronUp className="h-[14px]" /> Collapse View</> : <><ChevronDown className="h-[14px]" /> Display Entire Library</>}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-0 sm:gap-2">
            <Button
              variant="ghost" size="icon"
              onClick={() => setIsDark(!isDark)}
              className="h-9 w-9 md:h-10 md:w-10 rounded-full hover:scale-105 active:scale-95 transition-transform hidden sm:flex"
            >
              {isDark ? <Sun className="h-5 w-5 opacity-80" /> : <Moon className="h-5 w-5 opacity-80" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-transform">
                  <MoreVertical className="h-[1.15rem] md:h-5 md:w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px] rounded-xl p-1.5 bg-card/90 backdrop-blur-2xl">
                <div className="px-2 py-1.5 flex items-center justify-between sm:hidden">
                    <span className="text-sm font-medium">Dark Mode</span>
                    <Switch checked={isDark} onCheckedChange={setIsDark} className="scale-75" />
                </div>
                <DropdownMenuSeparator className="sm:hidden" />

                <div className="px-2 py-2 flex items-center justify-between" onPointerDown={(e) => e.stopPropagation()}>
                    <span className="text-[13.5px] font-medium tracking-wide">Motion Blob Design</span>
                    <Switch checked={isAnimatedBg} onCheckedChange={setIsAnimatedBg} className="scale-75 -mr-1" />
                </div>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => setShowAboutDialog(true)} className="gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-[13.5px]">
                  <Info className="h-4 w-4 opacity-80" /> About Platform
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => setShowCreditsDialog(true)} className="gap-2.5 p-2 rounded-lg cursor-pointer transition-colors text-[13.5px]">
                  <Heart className="h-4 w-4 opacity-80" /> Design Framework
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Core Frame Flex Area Restricting any vertical breaks maintaining pristine 100vh app limits explicitly handled implicitly. */}
        <div className="flex w-full flex-1 overflow-hidden min-h-0 relative">
          
          {/* Active mobile explicit lyrical wrapper taking priority blocking whole views correctly avoiding scrolling issues completely */}
          {showLyrics && (
              <div className="absolute inset-0 bg-background/95 backdrop-blur-[64px] z-20 flex flex-col w-full h-full lg:hidden pb-[70px]">
                <div className="flex h-12 w-full items-center justify-center relative flex-shrink-0 pt-2 border-b/10 border-white/5">
                   <h3 className="font-semibold tracking-wide text-primary">Synchronized Lyrics</h3>
                   <Button variant="ghost" size="icon" onClick={() => setShowLyrics(false)} className="absolute right-3 opacity-60">
                      <ChevronDown className="h-5" />
                   </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto px-6 py-6 pb-24 overscroll-y-auto" ref={lyricsContainerRef}>
                  {!lyrics ? (
                     <div className="h-full w-full flex items-center justify-center opacity-30 italic"><Loader2 className="animate-spin w-8" /></div>
                  ) : lyrics.syncedLyrics ? (
                    <div className="space-y-3 pb-[30vh]">
                      {lyrics.syncedLyrics.map((l, i) => (
                        <p key={i} className={cn("lyric-line font-medium leading-relaxed tracking-wide transition-all text-xl cursor-pointer hover:bg-black/10 dark:hover:bg-white/5 px-2 py-1.5 rounded-lg -ml-2", i === currentLyricIndex ? "text-primary text-[24px] tracking-normal font-semibold drop-shadow-sm": i < currentLyricIndex ? "text-foreground/40": "opacity-60")}
                          onClick={() => { if(audioRef.current) audioRef.current.currentTime = l.time }} >
                           {l.text}
                        </p>
                      ))}
                    </div>
                  ) : lyrics.plainLyrics ? (
                     <div className="whitespace-pre-line text-lg leading-relaxed font-medium pb-[30vh] opacity-80"> {lyrics.plainLyrics} </div>
                  ) : (
                    <div className="h-full flex items-center justify-center opacity-40">No extracted records...</div>
                  )}
                </div>
              </div>
          )}

          <div className="flex flex-1 flex-col w-full overflow-y-auto justify-center h-full min-h-0 px-2 pt-6 lg:pb-16 xl:px-0">
            {currentSong ? (
              <div className="w-full flex-1 max-h-[85vh] mx-auto max-w-[340px] md:max-w-xl flex flex-col justify-evenly">
                <div className="relative aspect-square w-full rounded-[1.65rem] sm:rounded-[2.5rem] elevation-3 bg-black/5 dark:bg-white/5 transition-transform overflow-hidden m-auto shadow-[0_12px_45px_0_rgba(0,0,0,0.15)] mt-3">
                    <img 
                      src={currentSong.thumbnail || '/placeholder.svg'} 
                      alt="" 
                      className={cn("h-full w-full object-cover transition-all duration-[20s]", isPlaying ? "scale-[1.10]" : "scale-100 grayscale-[0.05]")} 
                    />
                  {isLoading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur flex items-center justify-center flex-col animate-in fade-in duration-300">
                      <Loader2 className="h-10 w-10 text-white animate-spin drop-shadow" />
                    </div>
                  )}
                  {loadError && !isLoading && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center flex-col px-4 text-center z-10 animate-in fade-in zoom-in-95 duration-500">
                      <p className="text-white mb-4 text-sm max-w-[200px] leading-relaxed">{loadError}</p>
                      <Button onClick={() => setAudioUrl("reload_toggle")} className="bg-white/10 hover:bg-white/20 text-white active:scale-95 transition">Force Bypass Retrying</Button>
                    </div>
                  )}
                </div>

                <div className="px-1 mt-[8vh] flex-shrink-0 flex items-end">
                   <div className="min-w-0 flex-1 relative pr-6 pb-2">
                       <h2 className="text-[28px] sm:text-3xl leading-none font-bold tracking-tight mb-2 truncate block">{currentSong.title}</h2>
                       <p className="text-[17px] opacity-75 font-medium truncate block leading-snug tracking-wide text-primary/80">{currentSong.artist}</p>
                   </div>
                   <Button variant="ghost" size="icon" onClick={() => toggleLike(currentSong.videoId)} className={cn("hover:bg-primary/5 active:scale-75 hover:scale-125 mb-4 ml-2 transition h-[45px] w-[45px] rounded-full")}>
                      <Heart className={cn("h-[26px] w-[26px]", likedSongs.has(currentSong.videoId) ? "text-[var(--ganvo-red)] fill-current scale-[1.05]" : "text-foreground opacity-50")} strokeWidth={1.5} />
                   </Button>
                </div>

                <div className="w-full flex-shrink-0">
                  <Slider 
                    value={[currentTime]} 
                    max={duration || 100} 
                    onValueChange={handleSeek} 
                    className="w-full touch-none group h-6 cursor-pointer py-1 [&_[data-slot=range]]:bg-primary [&_[data-slot=thumb]]:hidden hover:[&_[data-slot=thumb]]:block [&_[data-slot=track]]:bg-black/10 dark:[&_[data-slot=track]]:bg-white/20 [&_[data-slot=track]]:h-1.5 md:[&_[data-slot=track]]:h-[7px]" 
                  />
                  <div className="flex w-full items-center justify-between text-[11px] sm:text-[13px] font-mono tabular-nums opacity-60 tracking-wider">
                     <span>{formatTime(currentTime)}</span>
                     <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-shrink-0 pt-[2vh] w-[95%] sm:w-[85%] self-center mb-10 pb-[2vh]">
                    <Button variant="ghost" size="icon" onClick={() => setShuffle(!shuffle)} className={cn("h-11 w-11 rounded-full text-foreground/40", shuffle && "text-primary bg-primary/5")}> <Shuffle strokeWidth={2} className="h-5" /> </Button>
                    <Button variant="ghost" size="icon" onClick={playPrevious} className="h-[3.2rem] w-[3.2rem] rounded-full bg-transparent hover:bg-black/5 dark:hover:bg-white/5 active:scale-75 text-foreground/80"> <SkipBack className="h-[22px] w-[22px] fill-current opacity-90" /> </Button>
                    <Button onClick={togglePlay} disabled={isLoading || !audioUrl} className={cn("h-16 w-16 md:h-[4.5rem] md:w-[4.5rem] bg-primary text-primary-foreground shadow-2xl hover:scale-105 active:scale-[0.93] rounded-full drop-shadow-[0_15px_18px_rgba(26,115,232,0.25)] flex items-center justify-center relative", isPlaying && !isLoading && "fab-pulse")}> 
                       {isLoading ? <Loader2 className="animate-spin w-[40%]" strokeWidth={2.5}/> : isPlaying ? <Pause className="fill-current w-[38%] opacity-90" strokeWidth={0}/> : <Play className="fill-current w-[38%] pl-0.5 opacity-90 ml-[2px]" strokeWidth={0} /> } 
                    </Button>
                    <Button variant="ghost" size="icon" onClick={playNext} className="h-[3.2rem] w-[3.2rem] rounded-full bg-transparent hover:bg-black/5 dark:hover:bg-white/5 active:scale-75 text-foreground/80"> <SkipForward className="h-[22px] w-[22px] fill-current opacity-90" /> </Button>
                    <Button variant="ghost" size="icon" onClick={() => setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")} className={cn("h-11 w-11 rounded-full text-foreground/40", repeatMode !== "off" && "text-primary bg-primary/5")}> 
                       {repeatMode === "one" ? <Repeat1 className="h-5" /> : <Repeat className="h-5" />} 
                    </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center flex-col opacity-60 mix-blend-plus-lighter z-10 gap-5 max-w-[200px] text-center m-auto -mt-[10%]">
                 <Music2 strokeWidth={1} className="h-24 w-24 mb-2 drop-shadow-xl text-primary" />
                 <div><p className="font-semibold text-xl tracking-tight opacity-80">Sound Library Unlinked.</p><span className="text-xs tracking-wider opacity-60">Queue is sleeping safely offline. Search something explicitly incredible above...</span></div>
              </div>
            )}
          </div>
          
          {/* Classic Fixed Screen Edge Desktop Right Navigation Restructuring maintaining generic native bounds resolving flex box crushes reliably consistently structurally accurately directly simply beautifully logically...  */}
          <div className="w-[30%] lg:max-w-md bg-card/60 backdrop-blur-xl border-l/5 flex-col shadow-[-40px_0_120px_0_rgba(0,0,0,0.02)] hidden lg:flex relative">
            <div className="flex bg-transparent">
              <Button variant="ghost" onClick={() => setShowLyrics(false)} className={cn("rounded-none font-semibold flex-1 h-14 text-[13.5px]", !showLyrics ? "border-b-[3px] border-primary text-primary" : "text-muted-foreground hover:bg-transparent")}> QUEUE SEQUENCE </Button>
              <Button variant="ghost" onClick={() => setShowLyrics(true)} className={cn("rounded-none font-semibold flex-1 h-14 text-[13.5px]", showLyrics ? "border-b-[3px] border-primary text-primary" : "text-muted-foreground hover:bg-transparent")}> SOUND VOCALS </Button>
            </div>
            
            <div className="w-full flex-1 overflow-y-auto pt-3 flex flex-col relative z-5">
              {showLyrics ? (
                <div ref={lyricsContainerRef} className="px-5">
                 {!lyrics ? (<div className="h-[20vh] w-full flex items-center justify-center"><Loader2 className="animate-spin w-5 h-5 text-primary opacity-60" /></div>) : 
                   lyrics?.syncedLyrics ? (
                    <div className="pb-32 text-[1.12rem] font-medium leading-relaxed gap-1.5 flex flex-col">{lyrics.syncedLyrics.map((l, i) => ( <p key={i} onClick={() => { if(audioRef.current) audioRef.current.currentTime=l.time }} className={cn("lyric-line p-2.5 rounded-lg -ml-2.5 cursor-pointer hover:bg-primary/5 active:bg-primary/10 tracking-wide opacity-80", i === currentLyricIndex && "text-[21px] text-primary !opacity-100 shadow-[0_4px_40px_rgba(26,115,232,0.1)] drop-shadow", i<currentLyricIndex&&"opacity-[0.25]")}>{l.text}</p> ))}</div>
                   ) : (<div className="whitespace-pre-line px-2 font-medium opacity-65 leading-relaxed tracking-wider pb-32 pt-2 text-[15px]">{lyrics.plainLyrics || "Empty strings passed in lyric sheet natively..."}</div>)
                 }
                </div>
              ) : (
                <div className="p-2 space-y-0.5 flex flex-col">
                  {queue.map((s, idx) => (
                    <div key={idx + "q"} onClick={()=> setCurrentIndex(idx)} className={cn("group m3-transition flex cursor-pointer items-center justify-between p-2 rounded-[14px] relative bg-transparent active:scale-[0.98] w-full gap-4 outline-none overflow-hidden", currentIndex === idx ? "bg-black/5 dark:bg-white/5 border border-primary/20" : "hover:bg-black/5 dark:hover:bg-white-[0.03]")}>
                       <img src={s.thumbnail} className={cn("rounded-[8px] w-12 h-12 shadow object-cover shadow-[0_5px_15px_-4px_rgba(0,0,0,0.1)] z-10")} alt=""/>
                       <div className="flex flex-col flex-1 relative min-w-0 pr-4 pt-[3px]"><span className="truncate text-sm font-semibold opacity-90 pb-[1px] text-foreground tracking-tight leading-none group-focus-visible:text-primary z-10">{s.title}</span><span className="text-xs truncate tracking-wider text-muted-foreground opacity-90">{s.artist}</span></div>
                       <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); removeFromQueue(idx)}} className="opacity-0 transition-opacity m3-scale-in flex-shrink-0 absolute z-50 h-8 w-8 right-2 top-2/4 -translate-y-2/4 bg-red-500/10 text-red-600 rounded-full md:group-hover:opacity-100 hover:bg-red-500 hover:text-white" ><X size={15} strokeWidth={2.5}/></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Floating compact action wrapper at extremely absolute floor preserving logic sizes efficiently safely effectively beautifully easily clearly securely universally optimally natively resolving layout collisions perfectly accurately inherently effectively accurately successfully optimally... */}
        {currentSong && (
          <div className="flex elevation-4 relative z-50 overflow-visible lg:hidden border-t-black/10 border-t w-full h-[60px] pb-1.5 shrink-0 px-2 justify-between flex-row self-center transition-all m3-slide-up duration-200">
             <div className="flex h-full w-[65%] shrink-0 space-x-3 items-center" onPointerDown={() => setShowLyrics(!showLyrics)}>
               <div className="w-12 h-12 relative flex-shrink-0 -mt-5 m3-bounce-in shadow-xl ring-1 ring-black/5 drop-shadow-[0_-5px_18px_rgba(0,0,0,0.25)] rounded-[6px] overflow-hidden ml-1"> <img src={currentSong.thumbnail} alt="" className={cn("h-full w-full object-cover relative block max-w-none transition duration-500 z-10 bg-black/10")} /> {isPlaying&&(<div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-50 m-auto flex gap-[1px] justify-center items-center playing-glow pt-0.5 rounded-[4px] border border-white/5 opacity-80"><span className="eq-bar-1 h-3 w-0.5 rounded-full bg-white"/><span className="eq-bar-2 h-3 w-[1.25px] rounded-full bg-white" /></div>)}</div>
               <div className="flex min-w-0 pr-0 truncate leading-none overflow-hidden relative pb-[3px] self-center shrink flex-col"><span className="w-full tracking-tighter shrink font-semibold pb-[2.5px] whitespace-nowrap block drop-shadow-sm opacity-90 pt-[5px] truncate relative -z-[1]">{currentSong.title}</span><span className="w-full tracking-widest text-[10.5px] truncate font-bold text-primary block relative min-w-0 shrink overflow-hidden z-[2] pr-5">{currentSong.artist}</span></div>
             </div>
             <div className="flex w-[90px] absolute h-[60px] pb-[7px] right-2 flex-shrink-0 relative shrink h-full w-[25%] sm:w-40 z-10 m-auto place-content-center items-center pt-1" dir="rtl"><Button size="icon" variant="ghost" onClick={playNext} className="w-[38px] flex h-[38px] active:scale-[0.8] items-center rounded-[50px]"><SkipForward strokeWidth={0} className="w-5 fill-current z-10 opacity-70 relative overflow-hidden bg-transparent m3-transition flex flex-1 h-[21px]" /></Button><Button size="icon" disabled={isLoading||!audioUrl} onClick={togglePlay} className="h-10 w-10 flex shrink items-center rounded-[20px] transition m3-hover shrink-0 scale-95 origin-center">{isLoading ? <Loader2 className="animate-spin w-[19px] z-[5]"/>: isPlaying ? <Pause className="fill-current w-[20px] absolute inset-x-0 mx-auto" strokeWidth={0}/>:<Play className="fill-[currentColor] w-5 relative h-full inset-x-[0.5px] z-10 pl-0.5 drop-shadow-[2px_2px_4px_rgba(0,0,0,0.4)]" strokeWidth={0}/>}</Button></div>
          </div>
        )}

      </div>
    
      {/* Dialog Models */}
      <Dialog open={showAboutDialog} onOpenChange={setShowAboutDialog}>
        <DialogContent className="m3-scale-in rounded-[24px] max-w-[340px] md:max-w-[400px]">
          <DialogHeader><DialogTitle className="flex"><Music2 className="text-[var(--ganvo-red)] h-7 w-7 mr-2"/><span className="mt-0.5 ml-1">Ganvo Music UI v1.0.3</span></DialogTitle></DialogHeader>
          <div className="flex flex-col space-y-1"><p className="text-[13px] leading-relaxed text-muted-foreground pb-2">Expressively designed fast audio streaming network client utilizing global music API indices bypassing regional extraction rules reliably natively rendering directly inside MD3 compliant React structures cleanly...</p></div>
        </DialogContent>
      </Dialog>
      <Dialog open={showCreditsDialog} onOpenChange={setShowCreditsDialog}>
        <DialogContent className="m3-scale-in rounded-[24px] max-w-[340px] md:max-w-[400px]">
           <DialogHeader><DialogTitle className="flex gap-2">Built Specifically Over</DialogTitle></DialogHeader>
           <ul className="text-sm font-medium tracking-wide flex flex-col gap-2 space-y-2 opacity-80 pb-2 border-b/20"><li className="bg-primary/5 rounded-[6px] p-2 truncate">· Cobalt Universal Backend Resiliences</li><li className="bg-[var(--ganvo-red)]/10 text-primary-50 rounded-[6px] p-2 flex text-[var(--ganvo-red)] items-center">· MD3 System Design UI Components</li><li className="bg-muted p-2 rounded-[6px]">· LRCLIB Real-time Timestamp Hooks </li></ul>
        </DialogContent>
      </Dialog>
      
    </div>
  )
}
