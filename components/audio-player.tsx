"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
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
  const [isDark, setIsDark] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Song[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [queue, setQueue] = useState<Song[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off")
  const [isLoading, setIsLoading] = useState(false)
  const [lyrics, setLyrics] = useState<LyricsData | null>(null)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1)
  const [showLyrics, setShowLyrics] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement>(null)
  const lyricsContainerRef = useRef<HTMLDivElement>(null)

  const currentSong = queue[currentIndex]

  // Toggle dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
  }, [isDark])

  // Search songs
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/music/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      setSearchResults(data.results || [])
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setIsSearching(false)
    }
  }

  // Add song to queue and play
  const addToQueueAndPlay = async (song: Song) => {
    const existingIndex = queue.findIndex((s) => s.videoId === song.videoId)
    if (existingIndex >= 0) {
      setCurrentIndex(existingIndex)
    } else {
      setQueue((prev) => [...prev, song])
      setCurrentIndex(queue.length)
    }
    setSearchResults([])
    setSearchQuery("")
  }

  // Load audio stream when song changes
  useEffect(() => {
    if (!currentSong) return

    const loadStream = async () => {
      setIsLoading(true)
      setAudioUrl(null)

      try {
        const response = await fetch(`/api/music/stream/${currentSong.videoId}`)
        const data = await response.json()

        if (data.audioUrl) {
          setAudioUrl(data.audioUrl)
        }
      } catch (error) {
        console.error("Failed to load stream:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadStream()
  }, [currentSong?.videoId])

  // Load lyrics when song changes
  useEffect(() => {
    if (!currentSong) return

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

        const response = await fetch(`/api/lyrics?${params}`)
        const data = await response.json()

        if (data.syncedLyrics || data.plainLyrics) {
          setLyrics({
            syncedLyrics: data.syncedLyrics,
            plainLyrics: data.plainLyrics,
          })
        }
      } catch (error) {
        console.error("Failed to load lyrics:", error)
      }
    }

    loadLyrics()
  }, [currentSong?.videoId])

  // Auto-play when audio URL is ready
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl
      audioRef.current.load()
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true)
        })
        .catch(console.error)
    }
  }, [audioUrl])

  // Update current lyric based on time
  useEffect(() => {
    if (!lyrics?.syncedLyrics) return

    const lyric = lyrics.syncedLyrics.findLast((l) => l.time <= currentTime)
    const index = lyric ? lyrics.syncedLyrics.indexOf(lyric) : -1

    if (index !== currentLyricIndex) {
      setCurrentLyricIndex(index)

      // Auto-scroll to current lyric
      if (lyricsContainerRef.current && index >= 0) {
        const lyricElements = lyricsContainerRef.current.querySelectorAll(".lyric-line")
        lyricElements[index]?.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }
  }, [currentTime, lyrics, currentLyricIndex])

  // Audio event handlers
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleEnded = () => {
    if (repeatMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play()
      }
    } else {
      playNext()
    }
  }

  // Playback controls
  const togglePlay = useCallback(() => {
    if (!audioRef.current || !audioUrl) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying, audioUrl])

  const playNext = useCallback(() => {
    if (queue.length === 0) return

    let nextIndex: number
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length)
    } else {
      nextIndex = (currentIndex + 1) % queue.length
    }

    if (nextIndex === 0 && repeatMode === "off" && !shuffle) {
      setIsPlaying(false)
      return
    }

    setCurrentIndex(nextIndex)
  }, [queue.length, currentIndex, shuffle, repeatMode])

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return

    if (currentTime > 3) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
      }
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
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100
    }
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
      if (index === queue.length - 1) {
        setCurrentIndex((prev) => prev - 1)
      }
    }
  }

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2

  return (
    <div className="flex h-screen flex-col bg-background transition-colors duration-300">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Header - Google style */}
      <header className="flex items-center justify-between border-b px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--google-red)] dark:bg-[var(--google-red)]">
            <Music2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-normal text-[#5f6368] dark:text-[#9aa0a6]">Google</span>
            <span className="text-xl font-medium">Music</span>
          </div>
        </div>

        {/* Search bar - Google style */}
        <div className="relative mx-4 max-w-2xl flex-1">
          <div className="relative flex items-center">
            <Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for songs, artists, or albums"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="h-12 w-full rounded-full border-0 bg-muted pl-12 pr-24 text-base shadow-none transition-shadow focus-visible:ring-0 focus-visible:shadow-md"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSearchQuery("")
                  setSearchResults([])
                }}
                className="absolute right-14 h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isSearching}
              className="absolute right-2 h-8 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="elevation-3 absolute top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border bg-card">
              <ScrollArea className="max-h-[400px]">
                <div className="p-2">
                  {searchResults.map((song) => (
                    <button
                      key={song.videoId}
                      onClick={() => addToQueueAndPlay(song)}
                      className="flex w-full items-center gap-4 rounded-xl p-3 text-left transition-colors hover:bg-muted"
                    >
                      <img
                        src={song.thumbnail || "/placeholder.svg"}
                        alt={song.title}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate font-medium">{song.title}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {song.artist} {song.album && `• ${song.album}`}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatTime(song.duration)}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {isSearching && (
            <div className="elevation-3 absolute top-full z-50 mt-2 flex w-full items-center justify-center rounded-2xl border bg-card py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Searching...</span>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsDark(!isDark)}
          className="h-10 w-10 rounded-full"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Player Area */}
        <div className="flex flex-1 flex-col items-center justify-center p-6 md:p-8">
          {currentSong ? (
            <div className="flex w-full max-w-md flex-col items-center">
              {/* Album Art */}
              <div className="relative mb-8">
                <div
                  className={cn(
                    "elevation-2 h-56 w-56 overflow-hidden rounded-2xl transition-all duration-500 sm:h-72 sm:w-72 md:h-80 md:w-80",
                    isPlaying && "scale-[1.02]"
                  )}
                >
                  <img
                    src={currentSong.thumbnail || "/placeholder.svg"}
                    alt={currentSong.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60">
                    <Loader2 className="h-12 w-12 animate-spin text-white" />
                  </div>
                )}
                {isPlaying && !isLoading && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 backdrop-blur-sm">
                    <span className="eq-bar-1 h-3 w-0.5 rounded-full bg-white" />
                    <span className="eq-bar-2 h-3 w-0.5 rounded-full bg-white" />
                    <span className="eq-bar-3 h-3 w-0.5 rounded-full bg-white" />
                    <span className="eq-bar-4 h-3 w-0.5 rounded-full bg-white" />
                  </div>
                )}
              </div>

              {/* Song Info */}
              <div className="mb-6 w-full text-center">
                <h2 className="mb-1 truncate text-xl font-medium sm:text-2xl">{currentSong.title}</h2>
                <p className="truncate text-base text-muted-foreground">{currentSong.artist}</p>
              </div>

              {/* Progress Bar */}
              <div className="mb-6 w-full">
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="mb-2 [&_[data-slot=range]]:bg-primary [&_[data-slot=thumb]]:h-3 [&_[data-slot=thumb]]:w-3 [&_[data-slot=thumb]]:border-2 [&_[data-slot=track]]:h-1"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="mb-6 flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShuffle(!shuffle)}
                  className={cn("h-10 w-10 rounded-full", shuffle && "bg-primary/10 text-primary")}
                >
                  <Shuffle className="h-5 w-5" />
                </Button>

                <Button variant="ghost" size="icon" onClick={playPrevious} className="h-12 w-12 rounded-full">
                  <SkipBack className="h-6 w-6 fill-current" />
                </Button>

                <Button
                  onClick={togglePlay}
                  disabled={isLoading || !audioUrl}
                  className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:bg-primary/90 sm:h-16 sm:w-16"
                >
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin sm:h-7 sm:w-7" />
                  ) : isPlaying ? (
                    <Pause className="h-6 w-6 fill-current sm:h-7 sm:w-7" />
                  ) : (
                    <Play className="h-6 w-6 fill-current pl-0.5 sm:h-7 sm:w-7" />
                  )}
                </Button>

                <Button variant="ghost" size="icon" onClick={playNext} className="h-12 w-12 rounded-full">
                  <SkipForward className="h-6 w-6 fill-current" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")}
                  className={cn("h-10 w-10 rounded-full", repeatMode !== "off" && "bg-primary/10 text-primary")}
                >
                  {repeatMode === "one" ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
                </Button>
              </div>

              {/* Volume & Lyrics Toggle */}
              <div className="flex w-full items-center justify-between gap-4">
                <div className="flex flex-1 items-center gap-3 rounded-full bg-muted px-4 py-2">
                  <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8 rounded-full p-0">
                    <VolumeIcon className="h-4 w-4" />
                  </Button>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={100}
                    step={1}
                    onValueChange={handleVolumeChange}
                    className="flex-1 [&_[data-slot=range]]:bg-foreground [&_[data-slot=thumb]]:h-3 [&_[data-slot=thumb]]:w-3 [&_[data-slot=track]]:h-1"
                  />
                  <span className="w-8 text-right text-xs text-muted-foreground">{isMuted ? 0 : volume}%</span>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowLyrics(!showLyrics)}
                  className={cn("h-10 w-10 rounded-full lg:hidden", showLyrics && "bg-primary/10 text-primary")}
                >
                  <Mic2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center px-4 text-center">
              <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-muted">
                <Music2 className="h-16 w-16 text-muted-foreground" />
              </div>
              <h2 className="mb-2 text-2xl font-medium">Start listening</h2>
              <p className="max-w-sm text-muted-foreground">
                Search for your favorite songs, artists, or albums to begin
              </p>
            </div>
          )}
        </div>

        {/* Sidebar - Queue & Lyrics */}
        <div className="hidden w-80 flex-col border-l bg-card lg:flex xl:w-96">
          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setShowLyrics(false)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 border-b-2 py-3.5 text-sm font-medium transition-colors",
                !showLyrics
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <ListMusic className="h-4 w-4" />
              Up next ({queue.length})
            </button>
            <button
              onClick={() => setShowLyrics(true)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 border-b-2 py-3.5 text-sm font-medium transition-colors",
                showLyrics
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Mic2 className="h-4 w-4" />
              Lyrics
            </button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            {showLyrics ? (
              <div ref={lyricsContainerRef} className="p-6">
                {lyrics?.syncedLyrics ? (
                  <div className="space-y-4">
                    {lyrics.syncedLyrics.map((line, index) => (
                      <p
                        key={index}
                        className={cn(
                          "lyric-line cursor-pointer rounded-lg px-2 py-1 text-lg leading-relaxed transition-all duration-300",
                          index === currentLyricIndex
                            ? "scale-[1.02] bg-primary/10 font-medium text-primary"
                            : index < currentLyricIndex
                              ? "text-muted-foreground/60"
                              : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => {
                          if (audioRef.current) {
                            audioRef.current.currentTime = line.time
                          }
                        }}
                      >
                        {line.text}
                      </p>
                    ))}
                  </div>
                ) : lyrics?.plainLyrics ? (
                  <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{lyrics.plainLyrics}</p>
                ) : currentSong ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Mic2 className="mb-4 h-12 w-12 text-muted-foreground/40" />
                    <p className="font-medium">No lyrics available</p>
                    <p className="mt-1 text-sm text-muted-foreground">Lyrics not found for this song</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Mic2 className="mb-4 h-12 w-12 text-muted-foreground/40" />
                    <p className="text-muted-foreground">Play a song to see lyrics</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2">
                {queue.length > 0 ? (
                  queue.map((song, index) => (
                    <div
                      key={`${song.videoId}-${index}`}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl p-2.5 transition-colors",
                        index === currentIndex ? "bg-primary/10" : "hover:bg-muted"
                      )}
                    >
                      <button onClick={() => setCurrentIndex(index)} className="flex flex-1 items-center gap-3 text-left">
                        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
                          <img
                            src={song.thumbnail || "/placeholder.svg"}
                            alt={song.title}
                            className="h-full w-full object-cover"
                          />
                          {index === currentIndex && isPlaying && (
                            <div className="absolute inset-0 flex items-center justify-center gap-0.5 bg-black/60">
                              <span className="eq-bar-1 h-3 w-0.5 rounded-full bg-white" />
                              <span className="eq-bar-2 h-3 w-0.5 rounded-full bg-white" />
                              <span className="eq-bar-3 h-3 w-0.5 rounded-full bg-white" />
                              <span className="eq-bar-4 h-3 w-0.5 rounded-full bg-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p
                            className={cn(
                              "truncate text-sm font-medium",
                              index === currentIndex && "text-primary"
                            )}
                          >
                            {song.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{song.artist}</p>
                        </div>
                      </button>
                      <span className="text-xs text-muted-foreground">{formatTime(song.duration)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromQueue(index)}
                        className="h-8 w-8 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <ListMusic className="mb-4 h-12 w-12 text-muted-foreground/40" />
                    <p className="font-medium">Your queue is empty</p>
                    <p className="mt-1 text-sm text-muted-foreground">Search and add songs to play</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Mobile Bottom Player */}
      {currentSong && (
        <div className="elevation-2 flex items-center gap-3 border-t bg-card p-3 lg:hidden">
          <img
            src={currentSong.thumbnail || "/placeholder.svg"}
            alt={currentSong.title}
            className="h-12 w-12 rounded-lg object-cover"
          />
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{currentSong.title}</p>
            <p className="truncate text-xs text-muted-foreground">{currentSong.artist}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlay}
            disabled={isLoading || !audioUrl}
            className="h-10 w-10 rounded-full"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current pl-0.5" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
