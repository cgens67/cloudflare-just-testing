"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { initializeApp, getApps, getApp } from "firebase/app"
import { 
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, User as FirebaseUser 
} from "firebase/auth"
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1,
  Search, Shuffle, Repeat, Repeat1, Moon, Loader2, Music2,
  X, ListMusic, MoreVertical, Info, Heart, ChevronDown,
  ChevronUp, ExternalLink, History, Library, UserCircle2, LogOut,
  Maximize, Minimize, Settings, TrendingUp, ListPlus, Disc3, MicVocal,
  ArrowLeft, Palette, LayoutTemplate, CornerUpRight, Star, 
  ChevronLeft, ChevronRight, ListFilter, EyeOff, Trash2, Rows3, Maximize2, Activity, Speaker, Video
} from "lucide-react"
import { cn } from "@/lib/utils"

const firebaseConfig = {
  apiKey: "AIzaSyBI-ABs1S7Ln2jJ7xYxgUZwU1nEXZmqI2c",
  authDomain: "ganvotesting.firebaseapp.com",
  projectId: "ganvotesting",
  storageBucket: "ganvotesting.firebasestorage.app",
  messagingSenderId: "1083596663051",
  appId: "1:1083596663051:web:52900f44e84034b7421a0e"
};

// Safe initialization to prevent Cloudflare Server crashes
let app: any = null;
let auth: any = null;
let db: any = null;
let googleProvider: any = null;

if (typeof window !== "undefined") {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
}

interface Song { videoId: string; title: string; artist: string; artistId?: string | null; album: string; duration: number; thumbnail: string; }
interface Playlist { id: string; name: string; songs: Song[]; }

const ScrollableRow = ({ children, title, icon: Icon }: { children: React.ReactNode, title?: string, icon?: any }) => {
  const rowRef = useRef<HTMLDivElement>(null)
  return (
    <div className="mb-6">
      {title && Icon && <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 text-foreground"><Icon className="h-6 w-6 text-primary"/> {title}</h3>}
      <div className="relative group/scroll">
        <Button variant="secondary" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex opacity-0 group-hover/scroll:opacity-100 transition-opacity rounded-full shadow-md" onClick={() => rowRef.current?.scrollBy({ left: -400, behavior: 'smooth' })}><ChevronLeft className="h-5 w-5 text-foreground" /></Button>
        <div className="w-full relative transform-gpu" style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)', maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}>
          <div ref={rowRef} className="flex overflow-x-auto overflow-y-hidden md:overflow-hidden overscroll-x-contain md:overscroll-auto gap-4 md:gap-6 snap-x no-scrollbar px-6 pt-4 pb-8 scroll-smooth items-center">
            {children}
          </div>
        </div>
        <Button variant="secondary" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex opacity-0 group-hover/scroll:opacity-100 transition-opacity rounded-full shadow-md" onClick={() => rowRef.current?.scrollBy({ left: 400, behavior: 'smooth' })}><ChevronRight className="h-5 w-5 text-foreground" /></Button>
      </div>
    </div>
  )
}

export function AudioPlayer() {
  const[isDark, setIsDark] = useState(false)
  const[isFullscreen, setIsFullscreen] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Song[]>([])
  const[searchSort, setSearchSort] = useState<'relevance' | 'az' | 'za'>('relevance')
  const[isSearching, setIsSearching] = useState(false)
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const[searchHistory, setSearchHistory] = useState<string[]>([])
  const [searchFocused, setSearchFocused] = useState(false)
  
  const [queue, setQueue] = useState<Song[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const[currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const[isMuted, setIsMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off")
  const[isLoading, setIsLoading] = useState(false)
  const[loadError, setLoadError] = useState<string | null>(null)
  const [playbackRate, setPlaybackRate] = useState(1)

  const [activeTab, setActiveTab] = useState<'player' | 'explore' | 'queue' | 'library' | 'artist' | 'album' | 'playlistView'>('explore')
  const [isMobilePlayerExpanded, setIsMobilePlayerExpanded] = useState(false)
  const[mobilePlayerTab, setMobilePlayerTab] = useState<'player' | 'queue'>('player')

  const[exploreData, setExploreData] = useState<{creatorsPicks: Song[], artists: any[], songs: Song[], albums: any[]}>({creatorsPicks:[], artists:[], songs: [], albums:[]})
  const[isExploreLoading, setIsExploreLoading] = useState(true)
  const[exploreError, setExploreError] = useState(false)
  
  const [currentArtistData, setCurrentArtistData] = useState<any>(null)
  const [isArtistLoading, setIsArtistLoading] = useState(false)
  const[currentAlbumData, setCurrentAlbumData] = useState<any>(null)
  const [isAlbumLoading, setIsAlbumLoading] = useState(false)
  const [currentPlaylistView, setCurrentPlaylistView] = useState<Playlist | null>(null)

  const[showAboutDialog, setShowAboutDialog] = useState(false)
  const [showCreditsDialog, setShowCreditsDialog] = useState(false)
  const [showAccountSettings, setShowAccountSettings] = useState(false) 
  const[showPlayerSettings, setShowPlayerSettings] = useState(false) 
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState("")
  
  const[dynamicTheme, setDynamicTheme] = useState(true)
  const [playerBgStyle, setPlayerBgStyle] = useState<'Theme' | 'Gradient' | 'Blur'>('Blur')
  const [thumbnailRadius, setThumbnailRadius] = useState(16)
  const [dominantColor, setDominantColor] = useState<string | null>(null)
  const[audioQuality, setAudioQuality] = useState<'High' | 'Standard' | 'Low'>('High')
  const[autoPlaySimilar, setAutoPlaySimilar] = useState(false)
  
  const [hideCreatorsPicks, setHideCreatorsPicks] = useState(false)
  const [compactQueue, setCompactQueue] = useState(false)
  const[autoSwitchToPlayer, setAutoSwitchToPlayer] = useState(true)
  const [saveSearchHistory, setSaveSearchHistory] = useState(true)
  const [reduceMotion, setReduceMotion] = useState(false)
  
  const[showAuthDialog, setShowAuthDialog] = useState(false)
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const[authError, setAuthError] = useState("")
  const [displayNameInput, setDisplayNameInput] = useState("")
  
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set())
  const[savedSongs, setSavedSongs] = useState<Song[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])

  const ytParentRef = useRef<HTMLDivElement>(null)
  const ytPlayerRef = useRef<any>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const handleEndedRef = useRef<() => void>(() => {})

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const currentSong = queue[currentIndex]

  useEffect(() => {
    let isActive = true;
    if (!currentSong?.thumbnail || playerBgStyle === 'Theme') {
      setDominantColor(null)
      return
    }
    const img = new Image()
    img.crossOrigin = "Anonymous"
    img.onload = () => {
      if (!isActive) return;
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 64
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(img, 0, 0, 64, 64)
      try {
        const data = ctx.getImageData(0, 0, 64, 64).data
        let r = 0, g = 0, b = 0
        let count = 0;
        for (let i = 0; i < data.length; i += 16) {
          r += data[i]; g += data[i+1]; b += data[i+2];
          count++;
        }
        if (count > 0) setDominantColor(`rgba(${~~(r/count)}, ${~~(g/count)}, ${~~(b/count)}, 0.45)`)
      } catch(e) { if (isActive) setDominantColor(null) }
    }
    img.src = currentSong.thumbnail;
    return () => { isActive = false; img.onload = null; }
  }, [currentSong?.thumbnail, playerBgStyle])

  const applyAudioEffects = useCallback(() => {
    if (ytPlayerRef.current?.setPlaybackRate) {
      try { ytPlayerRef.current.setPlaybackRate(playbackRate) } catch(e){}
    }
  },[playbackRate])

  useEffect(() => {
    applyAudioEffects()
  }, [playbackRate, applyAudioEffects])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => console.error(err))
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(err => console.error(err))
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  },[])

  useEffect(() => {
    try {
      const history = localStorage.getItem('ganvo_search_history')
      if (history) setSearchHistory(JSON.parse(history))
      const savedQuality = localStorage.getItem('ganvo_audio_quality')
      if (savedQuality) setAudioQuality(savedQuality as 'High' | 'Standard' | 'Low')
      const savedAutoPlay = localStorage.getItem('ganvo_autoplay_similar')
      if (savedAutoPlay !== null) setAutoPlaySimilar(savedAutoPlay === 'true')
      const savedHidePicks = localStorage.getItem('ganvo_hide_picks')
      if (savedHidePicks !== null) setHideCreatorsPicks(savedHidePicks === 'true')
      const savedCompactQueue = localStorage.getItem('ganvo_compact_queue')
      if (savedCompactQueue !== null) setCompactQueue(savedCompactQueue === 'true')
      const savedAutoSwitch = localStorage.getItem('ganvo_auto_switch_player')
      if (savedAutoSwitch !== null) setAutoSwitchToPlayer(savedAutoSwitch === 'true')
      const savedHistoryEnabled = localStorage.getItem('ganvo_save_history')
      if (savedHistoryEnabled !== null) setSaveSearchHistory(savedHistoryEnabled === 'true')
      const savedMotion = localStorage.getItem('ganvo_reduce_motion')
      if (savedMotion !== null) setReduceMotion(savedMotion === 'true')
    } catch (e) {}

    setIsExploreLoading(true)
    setExploreError(false)
    fetch('/api/music/explore')
      .then(res => res.json())
      .then(data => { 
        if (data && !data.error && data.artists && data.songs && data.albums) {
          setExploreData(data) 
        } else {
          setExploreError(true)
        }
      })
      .catch(() => setExploreError(true))
      .finally(() => setIsExploreLoading(false))
  },[])

  useEffect(() => {
    if (!auth || !db) return
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        setDisplayNameInput(currentUser.displayName || "")
        const userRef = doc(db, "users", currentUser.uid)
        const docSnap = await getDoc(userRef)
        if (docSnap.exists()) {
          const data = docSnap.data()
          const localSaved = JSON.parse(localStorage.getItem('ganvo_saved_songs') || '[]')
          const localPlaylists = JSON.parse(localStorage.getItem('ganvo_playlists') || '[]')
          
          const combinedSaved = [...(data.savedSongs || []), ...localSaved].filter((v,i,a) => a.findIndex(t => (t.videoId === v.videoId)) === i)
          const combinedPlaylists =[...(data.playlists || []), ...localPlaylists].filter((v,i,a) => a.findIndex(t => (t.id === v.id)) === i)
          
          setSavedSongs(combinedSaved)
          setLikedSongs(new Set(combinedSaved.map((s: Song) => s.videoId)))
          setPlaylists(combinedPlaylists)
          
          await setDoc(userRef, { savedSongs: combinedSaved, playlists: combinedPlaylists }, { merge: true })
        } else {
          await setDoc(userRef, { savedSongs: [], playlists:[] })
        }
      } else {
        const saved = localStorage.getItem('ganvo_saved_songs')
        const localPlaylists = localStorage.getItem('ganvo_playlists')
        if (saved) {
          const parsed = JSON.parse(saved)
          setSavedSongs(parsed)
          setLikedSongs(new Set(parsed.map((s: Song) => s.videoId)))
        } else {
          setSavedSongs([])
          setLikedSongs(new Set())
        }
        if (localPlaylists) setPlaylists(JSON.parse(localPlaylists))
        else setPlaylists([])
      }
    })
    return () => unsubscribe()
  },[])

  const syncToCloud = async (newSaved: Song[], newPlaylists: Playlist[]) => {
    localStorage.setItem('ganvo_saved_songs', JSON.stringify(newSaved))
    localStorage.setItem('ganvo_playlists', JSON.stringify(newPlaylists))
    if (user && db) {
      try {
        const userRef = doc(db, "users", user.uid)
        await setDoc(userRef, { savedSongs: newSaved, playlists: newPlaylists }, { merge: true })
      } catch (e) {}
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")
    if (!email.includes('@')) {
      setAuthError("Please include an '@' in the email address.")
      return
    }
    if (!auth) return
    try {
      if (isSignUp) await createUserWithEmailAndPassword(auth, email, password)
      else await signInWithEmailAndPassword(auth, email, password)
      setShowAuthDialog(false)
      setEmail("")
      setPassword("")
    } catch (error: any) { setAuthError(error.message.replace("Firebase: ", "")) }
  }

  const handleGoogleSignIn = async () => {
    if (!auth || !googleProvider) return
    setAuthError("")
    try {
      await signInWithPopup(auth, googleProvider)
      setShowAuthDialog(false)
    } catch (error: any) { setAuthError(error.message.replace("Firebase: ", "")) }
  }

  const handleSignOut = async () => { if (auth) await signOut(auth) }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (auth?.currentUser) {
      try {
        await updateProfile(auth.currentUser, { displayName: displayNameInput })
        setUser({ ...auth.currentUser }) 
        setShowAccountSettings(false)
      } catch (e) { console.error(e) }
    }
  }

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlaylistName.trim()) return
    const newPlaylist: Playlist = { id: Date.now().toString(), name: newPlaylistName.trim(), songs:[] }
    const updatedPlaylists = [...playlists, newPlaylist]
    setPlaylists(updatedPlaylists)
    syncToCloud(savedSongs, updatedPlaylists)
    setNewPlaylistName("")
    setShowPlaylistDialog(false)
  }

  const addSongToPlaylist = (playlistId: string, song: Song) => {
    const updatedPlaylists = playlists.map(p => {
      if (p.id === playlistId) {
        if (!p.songs.find(s => s.videoId === song.videoId)) {
          return { ...p, songs:[...p.songs, song] }
        }
      }
      return p
    })
    setPlaylists(updatedPlaylists)
    syncToCloud(savedSongs, updatedPlaylists)
  }

  const loadArtistView = async (artistId: string) => {
    setIsArtistLoading(true)
    setActiveTab('artist')
    setCurrentArtistData(null)
    setIsMobilePlayerExpanded(false)
    try {
      const res = await fetch(`/api/music/artist/${artistId}`)
      const data = await res.json()
      if (data && !data.error) setCurrentArtistData(data)
    } catch (e) {} finally { setIsArtistLoading(false) }
  }

  const loadAlbumView = async (albumId: string) => {
    setIsAlbumLoading(true)
    setActiveTab('album')
    setCurrentAlbumData(null)
    setIsMobilePlayerExpanded(false)
    try {
      const res = await fetch(`/api/music/album/${albumId}`)
      const data = await res.json()
      if (data && !data.error) setCurrentAlbumData(data)
    } catch (e) {} finally { setIsAlbumLoading(false) }
  }

  const loadPlaylistView = (playlist: Playlist) => {
    setCurrentPlaylistView(playlist)
    setActiveTab('playlistView')
    setIsMobilePlayerExpanded(false)
  }

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
  }, [isDark])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-radix-popper-content-wrapper]')) return;
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
        setIsSearchExpanded(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  },[])

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
      } catch (error) {} finally { setIsSearching(false) }
    }, 300)

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  },[searchQuery])

  const sortedSearchResults =[...searchResults].sort((a, b) => {
    if (searchSort === 'az') return a.title.localeCompare(b.title)
    if (searchSort === 'za') return b.title.localeCompare(a.title)
    return 0
  })

  const addToQueueAndPlay = async (song: Song) => {
    const saveSearchStr = searchQuery || song.title
    if (saveSearchStr.trim() && saveSearchHistory) {
      const newHistory =[saveSearchStr, ...searchHistory.filter(q => q !== saveSearchStr)].slice(0, 15)
      setSearchHistory(newHistory)
      localStorage.setItem('ganvo_search_history', JSON.stringify(newHistory))
    }
    
    if (autoSwitchToPlayer && typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setActiveTab('player');
    }
    
    const existingIndex = queue.findIndex((s) => s.videoId === song.videoId)
    
    if (existingIndex >= 0) {
      if (currentIndex === existingIndex && ytPlayerRef.current) {
        setIsLoading(true);
        setCurrentTime(0);
        ytPlayerRef.current.loadVideoById(song.videoId);
        ytPlayerRef.current.playVideo();
      } else {
        setCurrentIndex(existingIndex);
      }
    } else {
      setQueue((prev) => [...prev, song])
      setCurrentIndex(queue.length)
    }
    setSearchResults([])
    setSearchQuery("")
    setIsSearchExpanded(false)
    setSearchFocused(false)
  }

  useEffect(() => {
    handleEndedRef.current = async () => {
      if (repeatMode === "one") {
        if (ytPlayerRef.current && ytPlayerRef.current.seekTo) {
          ytPlayerRef.current.seekTo(0, true)
          ytPlayerRef.current.playVideo()
        }
      } else {
        if (currentIndex === queue.length - 1 && !shuffle && autoPlaySimilar && currentSong) {
          setIsLoading(true);
          try {
            const res = await fetch(`/api/music/search?q=${encodeURIComponent(currentSong.artist + ' ' + currentSong.title)}`);
            const data = await res.json();
            const similar = (data.results ||[]).filter((s: Song) => !queue.find(q => q.videoId === s.videoId));
            if (similar.length > 0) {
              setQueue(prev => [...prev, similar[0]]);
              setCurrentIndex(queue.length);
            } else setIsPlaying(false);
          } catch {
            setIsPlaying(false);
          } finally {
            setIsLoading(false);
          }
        } else {
          playNext()
        }
      }
    };
  });

  useEffect(() => {
    let isMounted = true;

    const initPlayer = () => {
      if (!ytParentRef.current || !isMounted) return;
      
      const playerDiv = document.createElement('div');
      playerDiv.className = 'w-full h-full';
      ytParentRef.current.innerHTML = '';
      ytParentRef.current.appendChild(playerDiv);

      ytPlayerRef.current = new (window as any).YT.Player(playerDiv, {
        height: '100%', width: '100%',
        videoId: currentSong?.videoId || '', 
        playerVars: { 
          playsinline: 1, 
          controls: 1, 
          disablekb: 0, 
          autoplay: 1,
          rel: 0,
          modestbranding: 1
        },
        events: {
          onReady: (event: any) => {
            if (isMounted && event.target.setVolume) {
                event.target.setVolume(volume);
                if (currentSong) {
                   setIsLoading(true);
                   event.target.loadVideoById(currentSong.videoId);
                   event.target.playVideo();
                }
            }
          },
          onStateChange: (e: any) => {
            if (!isMounted) return;
            if (e.data === 1) { 
              setIsPlaying(true); setIsLoading(false);
              setDuration(ytPlayerRef.current.getDuration() || 0);
            } else if (e.data === 2 || e.data === 0) { 
              setIsPlaying(false); setIsLoading(false);
              if (e.data === 0 && handleEndedRef.current) handleEndedRef.current();
            } else if (e.data === 3) {
              setIsPlaying(true); setIsLoading(true);
            }
          },
          onError: () => {
            setIsLoading(false); setIsPlaying(false);
            setLoadError("Video unavailable in your region. Trying next...");
            setTimeout(() => playNext(), 3000);
          }
        }
      });
    };

    if (typeof window !== "undefined") {
      if ((window as any).YT && (window as any).YT.Player) {
        initPlayer();
      } else {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScript = document.getElementsByTagName("script")[0];
        if (firstScript && firstScript.parentNode) firstScript.parentNode.insertBefore(tag, firstScript);
        else document.head.appendChild(tag);

        const existingCallback = (window as any).onYouTubeIframeAPIReady;
        (window as any).onYouTubeIframeAPIReady = () => {
          if (existingCallback) existingCallback();
          initPlayer();
        };
      }
    }

    return () => {
      isMounted = false;
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
         ytPlayerRef.current.destroy();
         ytPlayerRef.current = null;
      }
      if (ytParentRef.current) ytParentRef.current.innerHTML = '';
    };
  },[]);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
          const t = ytPlayerRef.current.getCurrentTime() || 0;
          const dur = ytPlayerRef.current.getDuration() || 0;
          setCurrentTime(t);
          if (dur > 0) setDuration(dur);
        }
      }, 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying]);

  useEffect(() => {
    if (currentSong && ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
      setIsLoading(true);
      setCurrentTime(0);
      setLoadError(null);
      ytPlayerRef.current.loadVideoById(currentSong.videoId);
      ytPlayerRef.current.playVideo();
    }
  },[currentSong?.videoId]);
  
  useEffect(() => {
    if (!currentSong) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.stopVideo === 'function') {
         ytPlayerRef.current.stopVideo();
      }
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [currentSong]);

  useEffect(() => {
    if (ytPlayerRef.current && ytPlayerRef.current.setVolume) ytPlayerRef.current.setVolume(volume);
    if (ytPlayerRef.current && ytPlayerRef.current.mute) isMuted ? ytPlayerRef.current.mute() : ytPlayerRef.current.unMute();
  },[volume, isMuted]);

  const playNext = useCallback(() => {
    if (queue.length === 0) return
    let nextIndex = shuffle ? Math.floor(Math.random() * queue.length) : (currentIndex + 1) % queue.length
    if (nextIndex === 0 && repeatMode === "off" && !shuffle) {
      setIsPlaying(false)
      if (ytPlayerRef.current) ytPlayerRef.current.pauseVideo()
      return
    }
    setCurrentIndex(nextIndex)
  },[queue.length, currentIndex, shuffle, repeatMode])

  const togglePlay = useCallback(() => {
    if (!ytPlayerRef.current) return
    if (isPlaying) ytPlayerRef.current.pauseVideo()
    else ytPlayerRef.current.playVideo()
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return
    if (currentTime > 3) {
      if (ytPlayerRef.current) ytPlayerRef.current.seekTo(0, true)
      return
    }
    setCurrentIndex((currentIndex - 1 + queue.length) % queue.length)
  },[queue.length, currentIndex, currentTime])

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index))
    if (index < currentIndex) setCurrentIndex((prev) => prev - 1)
    else if (index === currentIndex && queue.length > 1 && index === queue.length - 1) setCurrentIndex((prev) => prev - 1)
  }

  const toggleLike = async (song: Song) => {
    setLikedSongs((prev) => {
      const next = new Set(prev)
      let newSaved = [...savedSongs]
      if (next.has(song.videoId)) {
        next.delete(song.videoId)
        newSaved = newSaved.filter(s => s.videoId !== song.videoId)
      } else {
        next.add(song.videoId)
        newSaved.unshift(song)
      }
      setSavedSongs(newSaved)
      syncToCloud(newSaved, playlists)
      return next
    })
  }

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const showSearchDropdown = searchFocused && (searchResults.length > 0 || isSearching || (searchQuery.trim() === "" && searchHistory.length > 0))

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden font-sans relative z-0 bg-background transition-colors duration-1000">
      
      {/* THE UNIFIED FIXED YOUTUBE VIDEO PLAYER OVERLAY */}
      <div 
        className={cn(
          "bg-black transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden shrink-0",
          !currentSong ? "hidden" :
          isMobilePlayerExpanded && mobilePlayerTab === 'player' ? "fixed top-[72px] left-0 w-full aspect-video z-[250] rounded-none" :
          activeTab === 'player' ? "relative w-full max-w-5xl mx-auto aspect-video md:rounded-2xl z-[40] mt-0 md:mt-6" :
          "fixed bottom-24 right-4 w-[260px] sm:w-[320px] aspect-video rounded-xl z-[160] cursor-pointer hover:scale-105 transition-transform lg:bottom-8 lg:right-[440px] xl:right-[460px]"
        )}
        onClick={() => {
          if (currentSong && activeTab !== 'player' && !isMobilePlayerExpanded) {
             setActiveTab('player');
             window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      >
        <div ref={ytParentRef} className="w-full h-full pointer-events-auto"></div>
        {currentSong && activeTab !== 'player' && !isMobilePlayerExpanded && (
          <div className="absolute inset-0 z-10 bg-transparent flex flex-col justify-end p-2 opacity-0 hover:opacity-100 transition-opacity">
            <div className="text-white text-xs font-bold truncate drop-shadow-md bg-black/40 px-2 py-1 rounded-md w-fit">{currentSong.title}</div>
          </div>
        )}
      </div>

      {/* Dynamic Background */}
      {dynamicTheme && playerBgStyle === 'Gradient' && (
        <>
          <div className="absolute inset-0 z-[-2] transition-colors duration-1000 ease-in-out" style={{ backgroundColor: dominantColor || 'transparent' }} />
          <div className={cn("absolute inset-0 z-[-1] bg-gradient-to-b from-transparent via-background/60 to-background pointer-events-none transition-opacity duration-1000 ease-in-out", dominantColor ? "opacity-100" : "opacity-0")} />
        </>
      )}

      {dynamicTheme && playerBgStyle === 'Blur' && (
        <div className={cn("absolute inset-0 z-[-2] overflow-hidden pointer-events-none bg-background transition-opacity duration-1000 ease-in-out", currentSong ? "opacity-100" : "opacity-0")}>
          <img key={currentSong?.videoId || 'empty'} src={currentSong?.thumbnail || ''} className={cn("w-full h-full object-cover blur-2xl opacity-30 will-change-transform transform-gpu", !reduceMotion && "scale-[1.2]", currentSong ? (reduceMotion ? "animate-in fade-in duration-500" : "animate-in fade-in duration-1000") : "")} />
        </div>
      )}

      {/* Header */}
      <header className="elevation-1 z-40 flex h-16 flex-shrink-0 items-center justify-between px-3 md:px-6 transition-all duration-500 ease-out relative bg-background/90 backdrop-blur-xl border-b border-border/40 gap-2">
        <div className={cn("flex items-center shrink-0 transition-all duration-500 origin-left whitespace-nowrap overflow-hidden", searchFocused ? "max-w-0 opacity-0 gap-0 border-0 p-0 mr-0 md:max-w-[280px] md:opacity-100 md:gap-3 md:mr-4" : "max-w-[280px] opacity-100 mr-2 md:mr-4 gap-3")}>
          <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--google-red)] shadow-md", !reduceMotion && "transition-transform duration-700 hover:scale-110")}>
            <Video className="h-5 w-5 text-white fill-current" />
          </div>
          <div className="hidden sm:flex items-baseline pl-1 opacity-100 transition-opacity duration-300">
            <span className="text-[20px] font-bold tracking-tight text-foreground ml-1">VideoPlayer</span>
          </div>
        </div>

        {/* Search bar */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-2xl mx-auto w-full transition-all duration-500">
          <div className="relative flex items-center">
            <Search className="absolute left-4 h-5 w-5 text-muted-foreground transition-colors" />
            <Input
              type="text"
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              className={cn(
                "h-11 md:h-12 w-full rounded-full border-0 bg-muted/80 pl-12 pr-12 text-base shadow-none transition-all duration-500 text-foreground outline-none focus:outline-none focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-card focus-visible:shadow-lg sm:placeholder:text-transparent md:placeholder:text-muted-foreground",
                searchFocused && "bg-card shadow-lg ring-2 ring-[var(--google-red)]"
              )}
            />
            {searchQuery && (
              <Button variant="ghost" size="icon" onClick={() => { setSearchQuery(""); setSearchResults([]) }} className="absolute right-2 h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-95">
                <X className="h-4 w-4 text-current" />
              </Button>
            )}
          </div>

          {/* Search Dropdown */}
          {showSearchDropdown && (
            <div className="absolute left-0 right-0 top-full z-[60] mt-3 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300 ease-out max-w-full">
              <div className={cn("flex-1 overflow-y-auto min-h-0 overscroll-contain transition-all duration-500", isSearchExpanded ? "max-h-[70vh]" : "max-h-[400px]")}>
                <div className="p-2">
                  {searchQuery.trim() === "" ? (
                    <div className="animate-in fade-in duration-500">
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Searches</span>
                        <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setSearchHistory([]); localStorage.removeItem('ganvo_search_history') }} className="text-xs font-medium text-muted-foreground hover:text-[var(--google-red)] transition-colors">Clear</button>
                      </div>
                      {searchHistory.map((historyItem, idx) => (
                        <button key={`history-${idx}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setSearchQuery(historyItem)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 hover:bg-muted active:scale-[0.98] text-foreground">
                          <History className="h-4 w-4 text-muted-foreground opacity-70" />
                          <span className="font-medium text-sm">{historyItem}</span>
                        </button>
                      ))}
                    </div>
                  ) : isSearching && searchResults.length === 0 ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--google-red)]" /><span className="ml-3 text-muted-foreground font-medium">Searching...</span></div>
                  ) : (
                    <div className="animate-in fade-in duration-500">
                      <div className="flex items-center justify-between p-3 mb-2 border-b bg-muted/20 rounded-xl">
                        <span className="text-xs font-bold text-muted-foreground ml-2">RESULTS</span>
                        <Select value={searchSort} onValueChange={(v: any) => setSearchSort(v)}>
                          <SelectTrigger className="h-7 text-xs w-[120px] rounded-full border-none bg-muted font-bold text-foreground outline-none focus:ring-0"><SelectValue placeholder="Sort" /></SelectTrigger>
                          <SelectContent className="rounded-xl z-[400]"><SelectItem value="relevance" className="font-semibold text-xs py-2 rounded-lg">Relevance</SelectItem><SelectItem value="az" className="font-semibold text-xs py-2 rounded-lg">A - Z</SelectItem><SelectItem value="za" className="font-semibold text-xs py-2 rounded-lg">Z - A</SelectItem></SelectContent>
                        </Select>
                      </div>
                      {sortedSearchResults.slice(0, isSearchExpanded ? undefined : 6).map((song, index) => (
                        <button key={song.videoId} onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToQueueAndPlay(song) }} className="song-card active:scale-[0.98] flex w-full items-center gap-4 rounded-xl p-2 text-left hover:bg-secondary/60 text-foreground transition-all duration-300 ease-out">
                          <img src={song.thumbnail || "/placeholder.svg"} alt={song.title} className="aspect-video w-[100px] rounded-lg object-cover shadow-sm transition-transform duration-500 hover:scale-105" />
                          <div className="flex-1 overflow-hidden">
                            <p className="truncate font-medium leading-tight text-foreground">{song.title}</p>
                            <p className="truncate text-sm text-muted-foreground mt-0.5">{song.artist} {song.album && `• ${song.album}`}</p>
                          </div>
                          <span className="flex-shrink-0 text-xs font-medium text-muted-foreground/80 pr-2">{formatTime(song.duration)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {searchQuery.trim() !== "" && searchResults.length > 6 && (
                <div className="flex-shrink-0 border-t bg-card/80 backdrop-blur-md p-2">
                  <Button variant="ghost" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsSearchExpanded(!isSearchExpanded) }} className="w-full justify-center gap-2 rounded-lg hover:bg-primary/10 text-foreground transition-all duration-300 active:scale-[0.98]">
                    {isSearchExpanded ? <><ChevronUp className="h-4 w-4 transition-transform duration-300 text-current" />Show less</> : <><ChevronDown className="h-4 w-4 transition-transform duration-300 text-current" />Show all {searchResults.length} results</>}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Header Interface */}
        <div className="flex items-center gap-1 md:gap-2 shrink-0 ml-2">
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="hidden sm:flex h-10 w-10 rounded-full text-foreground hover:bg-muted active:scale-90 transition-transform hover:scale-110">
            {isFullscreen ? <Minimize className="h-5 w-5 fill-current" /> : <Maximize className="h-5 w-5 fill-current" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-foreground hover:bg-muted active:scale-90 transition-transform hover:scale-110">
                {user ? (
                  <div className="h-7 w-7 rounded-full bg-[var(--google-red)] text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                    {user.displayName ? user.displayName.charAt(0) : user.email?.charAt(0) || "U"}
                  </div>
                ) : (
                  <UserCircle2 className="h-5 w-5 text-current" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl animate-in fade-in zoom-in-95 duration-300 ease-out p-2 shadow-xl border-border/50 z-[250]">
              {user ? (
                <div className="px-3 py-2.5 mb-1 bg-muted/50 rounded-xl">
                  <p className="text-sm font-bold truncate text-foreground">{user.displayName || "Library Synced"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              ) : (
                <div className="px-2 py-2 mb-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Account</p>
                  <Button onClick={() => setShowAuthDialog(true)} className="w-full justify-start rounded-xl font-semibold transition-all active:scale-[0.98] bg-[var(--google-red)] text-white hover:bg-[var(--google-red)]/90" size="sm">Sign In / Sign Up</Button>
                </div>
              )}
              <DropdownMenuSeparator />
              {user && (
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => setShowAccountSettings(true), 100); }} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium transition-colors active:scale-[0.98] text-foreground">
                  <UserCircle2 className="h-4 w-4 text-muted-foreground text-current" /> Account Details
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => setShowPlayerSettings(true), 100); }} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium transition-colors active:scale-[0.98] text-foreground">
                <Settings className="h-4 w-4 text-muted-foreground text-current" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => setShowAboutDialog(true), 100); }} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium transition-colors active:scale-[0.98] text-foreground">
                <Info className="h-4 w-4 text-muted-foreground text-current" /> About
              </DropdownMenuItem>
              {user && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium text-[var(--google-red)] focus:text-[var(--google-red)] transition-colors active:scale-[0.98]">
                    <LogOut className="h-4 w-4 text-current" /> Sign Out
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Core Layout */}
      <div className="flex flex-1 overflow-hidden min-h-0 bg-transparent relative z-10">
        <div className="flex flex-1 flex-col overflow-y-auto min-h-0 z-10 pb-40 lg:pb-0 transition-all duration-500 ease-out no-scrollbar">
          
          {/* Main Screen Renders */}
          {activeTab === 'explore' ? (
             <div className="p-6 md:p-10 max-w-6xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
               <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 text-foreground">Explore</h2>
               <p className="text-muted-foreground font-medium mb-10 text-lg">Discover trending videos and popular creators.</p>
               
               {isExploreLoading ? (
                 <div className="flex flex-col items-center justify-center py-32"><Loader2 className="h-10 w-10 animate-spin text-[var(--google-red)] mb-4" /><p className="font-bold text-lg text-muted-foreground">Discovering...</p></div>
               ) : exploreError ? (
                 <div className="flex flex-col items-center justify-center py-32 text-center"><TrendingUp className="h-16 w-16 text-muted-foreground/40 mb-6" /><p className="font-extrabold text-2xl mb-2 text-foreground">Explore Unavailable</p><p className="text-sm font-medium text-muted-foreground max-w-[300px]">Use the search bar to find videos.</p></div>
               ) : (
                 <div className="space-y-12">
                   {!hideCreatorsPicks && exploreData?.creatorsPicks?.length > 0 && (
                     <ScrollableRow title="Trending Videos" icon={Star}>
                        {exploreData.creatorsPicks.map((song, idx) => (
                          <div key={idx} onClick={() => addToQueueAndPlay(song)} className="group flex flex-col gap-3 w-64 shrink-0 cursor-pointer snap-start transition-all">
                            <div className={cn("overflow-hidden rounded-xl shadow-md aspect-video relative", !reduceMotion && "transition-transform duration-500 group-hover:scale-105 group-active:scale-95")}>
                              <img src={song.thumbnail} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                <Play className="h-10 w-10 text-white fill-white" />
                              </div>
                            </div>
                            <div>
                              <p className="font-bold text-sm truncate text-foreground group-hover:text-[var(--google-red)] transition-colors">{song.title}</p>
                              <p className="text-xs font-medium text-muted-foreground mt-0.5 truncate">{song.artist}</p>
                            </div>
                          </div>
                        ))}
                     </ScrollableRow>
                   )}
                   {exploreData?.artists?.length > 0 && (
                     <ScrollableRow title="Popular Creators" icon={UserCircle2}>
                        {exploreData.artists.map((artist, idx) => (
                          <div key={artist.artistId || idx} onClick={() => loadArtistView(artist.artistId)} className="group flex flex-col items-center gap-4 cursor-pointer snap-start w-32 sm:w-40 shrink-0 transition-all">
                            <div className={cn("relative w-full aspect-square rounded-full overflow-hidden shadow-lg", !reduceMotion && "transition-transform duration-700 group-hover:scale-105 group-active:scale-95")}>
                              <img src={artist.thumbnail || "/placeholder.svg"} alt={artist.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </div>
                            <div className="text-center w-full px-2">
                              <p className="font-bold text-sm truncate transition-colors group-hover:text-[var(--google-red)] text-foreground">{artist.name}</p>
                              <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">{artist.subscribers}</p>
                            </div>
                          </div>
                        ))}
                     </ScrollableRow>
                   )}
                   {exploreData?.songs?.length > 0 && (
                     <div>
                       <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-foreground"><TrendingUp className="h-6 w-6 text-[var(--google-red)]"/> Latest Videos</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {exploreData.songs.slice(0, 9).map((song, idx) => (
                            <div key={idx} className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-muted transition-colors duration-300 ease-out bg-card shadow-sm border cursor-pointer" onClick={() => addToQueueAndPlay(song)}>
                              <img src={song.thumbnail} className={cn("aspect-video w-24 rounded-lg object-cover shadow-sm", !reduceMotion && "transition-transform duration-500 group-hover:scale-105")} />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate text-foreground group-hover:text-[var(--google-red)] transition-colors">{song.title}</p>
                                <p className="text-xs font-medium text-muted-foreground truncate mt-0.5">{song.artist}</p>
                              </div>
                            </div>
                          ))}
                       </div>
                     </div>
                   )}
                 </div>
               )}
             </div>
          ) : activeTab === 'player' ? (
            <div className="flex flex-col flex-1 w-full p-4 md:p-8 max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-500">
               {loadError && (
                 <div className="bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-xl font-bold text-sm shadow-lg mb-4 text-center">
                   {loadError}
                 </div>
               )}
               {currentSong ? (
                 <div className="flex flex-col w-full mt-4 md:mt-8">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight mb-1">{currentSong.title}</h2>
                    <div className="flex items-center justify-between mb-8">
                       <button onClick={() => currentSong.artistId && loadArtistView(currentSong.artistId)} className="text-lg font-semibold text-muted-foreground hover:text-[var(--google-red)] hover:underline transition-colors outline-none focus:outline-none">
                         {currentSong.artist}
                       </button>
                       <Button variant="ghost" size="icon" onClick={() => toggleLike(currentSong)} className="h-12 w-12 rounded-full hover:bg-[var(--google-red)]/10 text-foreground transition-all active:scale-75">
                         <Heart className={cn("h-6 w-6 transition-transform", likedSongs.has(currentSong.videoId) ? "fill-[var(--google-red)] text-[var(--google-red)] scale-110" : "")} />
                       </Button>
                    </div>

                    <div className="w-full bg-card/60 backdrop-blur-md rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between border shadow-sm gap-4">
                       <div className="flex items-center gap-4">
                          <Button variant="ghost" size="icon" onClick={() => setShuffle(!shuffle)} className={cn("h-12 w-12 rounded-full transition-colors", shuffle ? "bg-[var(--google-red)]/15 text-[var(--google-red)]" : "text-muted-foreground hover:text-foreground")}><Shuffle className="h-5 w-5" /></Button>
                          <Button variant="ghost" size="icon" onClick={playPrevious} className="h-12 w-12 rounded-full text-foreground hover:bg-muted active:scale-90"><SkipBack className="h-6 w-6 fill-current text-current" /></Button>
                          <Button variant="secondary" size="icon" onClick={togglePlay} className="h-14 w-14 rounded-full active:scale-90 transition-transform">
                             {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current translate-x-[2px]" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={playNext} className="h-12 w-12 rounded-full text-foreground hover:bg-muted active:scale-90"><SkipForward className="h-6 w-6 fill-current text-current" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")} className={cn("h-12 w-12 rounded-full transition-colors", repeatMode !== "off" ? "bg-[var(--google-red)]/15 text-[var(--google-red)]" : "text-foreground")}>
                             {repeatMode === "one" ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
                          </Button>
                       </div>
                       
                       <div className="flex items-center gap-3">
                         <span className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 rounded-full uppercase tracking-wider">Up Next</span>
                         <div className="text-sm font-bold text-foreground max-w-[200px] truncate">
                            {queue[currentIndex + 1] ? queue[currentIndex + 1].title : "End of Queue"}
                         </div>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                    <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-[2rem] bg-muted/50 shadow-inner">
                      <Video className="h-16 w-16 text-muted-foreground/40" />
                    </div>
                    <h2 className="mb-2 text-2xl font-extrabold text-foreground">Nothing Playing</h2>
                    <p className="text-muted-foreground font-medium">Search for videos to start watching.</p>
                 </div>
               )}
            </div>
          ) : activeTab === 'artist' ? (
             <div className="p-4 md:p-10 max-w-6xl mx-auto w-full animate-in fade-in slide-in-from-right-8 duration-700 ease-out">
                <Button variant="ghost" onClick={() => setActiveTab('explore')} className="mb-6 -ml-2 md:-ml-4 gap-2 font-bold text-muted-foreground hover:text-foreground transition-all"><SkipBack className="h-4 w-4 fill-current text-current" /> Back to Explore</Button>
                {isArtistLoading ? (
                  <div className="flex flex-col items-center justify-center py-32"><Loader2 className="h-10 w-10 animate-spin text-[var(--google-red)] mb-4" /><p className="font-bold text-lg text-muted-foreground">Loading Creator Profile...</p></div>
                ) : currentArtistData ? (
                  <div className="animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 mb-12 p-4 md:p-8 bg-card/50 rounded-[2.5rem] border shadow-sm backdrop-blur-sm">
                      <img src={currentArtistData.thumbnails?.[currentArtistData.thumbnails.length-1]?.url || "/placeholder.svg"} alt={currentArtistData.name} className="aspect-square w-48 h-48 md:w-56 md:h-56 rounded-full object-cover shadow-xl" />
                      <div className="text-center md:text-left flex-1 flex flex-col justify-center">
                        <div className="flex items-center justify-center md:justify-start gap-2 text-[var(--google-red)] font-bold text-sm mb-2 uppercase tracking-widest"><MicVocal className="h-4 w-4"/> Channel</div>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-2 text-foreground">{currentArtistData.name}</h1>
                        <p className="text-muted-foreground font-semibold mb-4 text-lg">{currentArtistData.subscribers}</p>
                        <p className="text-sm leading-relaxed max-w-3xl text-muted-foreground/90 line-clamp-3 md:line-clamp-none">{currentArtistData.description}</p>
                      </div>
                    </div>
                    
                    <h3 className="text-2xl font-bold mb-4 md:mb-6 flex items-center gap-2 text-foreground"><TrendingUp className="h-6 w-6 text-[var(--google-red)]"/> Popular Videos</h3>
                    <div className="space-y-1 md:space-y-2 mb-12 bg-card p-4 rounded-[2rem] border shadow-sm">
                      {currentArtistData.topSongs?.map((song: any, idx: number) => (
                        <div key={song.videoId} className="group flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-2xl hover:bg-muted transition-colors duration-300 ease-out cursor-pointer" onClick={() => addToQueueAndPlay(song)}>
                          <span className="w-6 text-center font-bold text-muted-foreground/50">{idx + 1}</span>
                          <img src={song.thumbnail} className={cn("aspect-video w-24 rounded-lg object-cover shadow-sm", !reduceMotion && "transition-transform duration-500 group-hover:scale-105")} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate text-foreground group-hover:text-[var(--google-red)]">{song.title}</p>
                            <p className="text-xs font-medium text-muted-foreground truncate mt-0.5">{song.album}</p>
                          </div>
                          
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); toggleLike(song) }} className={cn("text-muted-foreground hover:text-[var(--google-red)] transition-all", likedSongs.has(song.videoId) && "text-[var(--google-red)]")}>
                            <Heart className={cn("h-5 w-5", likedSongs.has(song.videoId) && "fill-current text-current")} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-foreground">Failed to load creator.</p>
                )}
             </div>
          ) : activeTab === 'playlistView' && currentPlaylistView ? (
             <div className="p-4 md:p-10 max-w-6xl mx-auto w-full animate-in fade-in slide-in-from-right-8 duration-700 ease-out">
                <Button variant="ghost" onClick={() => setActiveTab('library')} className="mb-6 -ml-2 md:-ml-4 gap-2 font-bold text-muted-foreground hover:text-foreground transition-all">
                  <SkipBack className="h-4 w-4 fill-current text-current" /> Back to Library
                </Button>
                <div className="animate-in fade-in duration-500">
                  <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 mb-12 p-4 md:p-8">
                    <div className="w-48 h-48 md:w-64 md:h-64 rounded-2xl object-cover shadow-2xl bg-[var(--google-red)]/10 flex items-center justify-center">
                      <ListMusic className="h-20 w-20 text-[var(--google-red)]" />
                    </div>
                    <div className="text-center md:text-left flex-1 flex flex-col justify-end">
                      <div className="flex items-center justify-center md:justify-start gap-2 text-[var(--google-red)] font-bold text-sm mb-2 uppercase tracking-widest"><ListPlus className="h-4 w-4"/> Playlist</div>
                      <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-2 text-foreground">{currentPlaylistView.name}</h1>
                      <p className="text-muted-foreground font-semibold mb-6 text-lg">{currentPlaylistView.songs.length} videos</p>
                      <div className="flex gap-3 justify-center md:justify-start">
                        <Button onClick={() => {if(currentPlaylistView.songs.length>0) addToQueueAndPlay(currentPlaylistView.songs[0])}} disabled={currentPlaylistView.songs.length===0} className="rounded-full font-bold text-base px-8 h-12 shadow-lg hover:scale-105 active:scale-95 transition-all bg-[var(--google-red)] text-white">
                          <Play className="h-5 w-5 mr-2 fill-current"/> Play All
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {currentPlaylistView.songs.length > 0 ? (
                    <div className="space-y-1 mb-12 bg-card p-2 md:p-4 rounded-[2rem] border shadow-sm">
                      {currentPlaylistView.songs.map((song: any, idx: number) => (
                        <div key={song.videoId} className="group flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-2xl hover:bg-muted transition-colors duration-300 ease-out cursor-pointer" onClick={() => addToQueueAndPlay(song)}>
                          <span className="w-6 text-center font-bold text-muted-foreground/50">{idx + 1}</span>
                          <img src={song.thumbnail} className={cn("aspect-video w-24 rounded-xl object-cover shadow-sm", !reduceMotion && "transition-transform duration-500 group-hover:scale-105")} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate text-foreground group-hover:text-[var(--google-red)]">{song.title}</p>
                            <p className="text-xs font-medium text-muted-foreground truncate mt-0.5">{song.artist}</p>
                          </div>
                          <span className="text-xs font-bold tabular-nums text-muted-foreground/50 mr-2">{formatTime(song.duration)}</span>
                          
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); toggleLike(song) }} className={cn("text-muted-foreground hover:text-[var(--google-red)] transition-all", likedSongs.has(song.videoId) && "text-[var(--google-red)]")}>
                            <Heart className={cn("h-5 w-5", likedSongs.has(song.videoId) && "fill-current text-current")} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <ListMusic className="h-12 w-12 text-muted-foreground/40 mb-4" />
                      <p className="font-bold text-xl mb-2 text-foreground">Empty Playlist</p>
                      <p className="text-sm text-muted-foreground">Add videos from the explore page or search.</p>
                    </div>
                  )}
                </div>
             </div>
          ) : null}
        </div>

        {/* Desktop Sidebar - Queue & Library */}
        <div className="hidden w-80 flex-col border-l border-border/40 bg-card/40 backdrop-blur-2xl lg:flex xl:w-[420px] overflow-hidden min-h-0 shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-20 transition-all duration-500">
          <div className="flex p-3 gap-2 bg-muted/20 border-b border-border/40 flex-wrap transition-colors duration-300">
            {['player', 'explore', 'queue', 'library'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs xl:text-sm font-bold transition-all duration-300 ease-out active:scale-95 flex-1 outline-none",
                  activeTab === tab ? "bg-background shadow-sm text-foreground scale-105" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {tab === 'player' && <Video className="h-4 w-4 text-current fill-current" />}
                {tab === 'explore' && <TrendingUp className="h-4 w-4 text-current" />}
                {tab === 'queue' && <ListMusic className="h-4 w-4 text-current" />}
                {tab === 'library' && <Library className="h-4 w-4 text-current" />}
                <span className="capitalize hidden xl:inline">{tab}</span>
              </button>
            ))}
          </div>

          <div className={cn(
            "flex-1 min-h-0 overscroll-contain transition-all duration-500", ['queue', 'library'].includes(activeTab) ? "overflow-hidden flex flex-col" : "overflow-y-auto"
          )}>
            {activeTab === 'explore' || activeTab === 'artist' || activeTab === 'album' || activeTab === 'playlistView' || activeTab === 'player' ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <Video className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="font-bold text-lg text-foreground capitalize">{activeTab} is open</p>
                <p className="text-sm text-muted-foreground mt-2">Check the main view on the left.</p>
              </div>
            ) : activeTab === 'library' ? (
               <div className="h-full w-full relative overflow-hidden" style={{ isolation: 'isolate', maskImage: 'linear-gradient(to bottom, black 0%, black 90%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 90%, transparent 100%)' }}>
                 <div className="h-full w-full p-4 space-y-6 pb-32 animate-in slide-in-from-bottom-8 duration-700 ease-out overflow-y-auto overscroll-contain no-scrollbar">
                  {/* Playlists */}
                  <div>
                    <div className="mb-4 px-2 flex items-center justify-between">
                      <h3 className="font-bold text-lg flex items-center gap-2 text-foreground"><ListPlus className="h-5 w-5 text-current"/> Playlists</h3>
                      <Button variant="secondary" size="sm" onClick={() => setShowPlaylistDialog(true)} className="rounded-xl font-bold text-xs h-8">New</Button>
                    </div>
                    {playlists.length > 0 ? (
                      <div className="space-y-2">
                        {playlists.map((playlist) => (
                          <div key={playlist.id} onClick={() => loadPlaylistView(playlist)} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 hover:bg-muted transition-colors cursor-pointer text-foreground">
                            <div className="h-12 w-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-black shadow-sm"><ListMusic className="h-5 w-5 text-current"/></div>
                            <div>
                              <p className="font-bold text-sm">{playlist.name}</p>
                              <p className="text-xs font-medium text-muted-foreground">{playlist.songs.length} videos</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground px-2 font-medium">No playlists created yet.</p>
                    )}
                  </div>

                  {/* Liked Videos */}
                  <div>
                    <div className="mb-4 px-2 flex items-center justify-between">
                      <h3 className="font-bold text-lg flex items-center gap-2 text-foreground"><Heart className="h-5 w-5 text-[var(--google-red)] fill-current"/> Liked Videos</h3>
                    </div>
                    {savedSongs.length > 0 ? (
                      <div className="space-y-2">
                        {savedSongs.map((song, index) => (
                          <div key={`lib-${song.videoId}-${index}`} className="group flex items-center gap-3 rounded-2xl p-2 transition-all duration-300 hover:bg-muted">
                            <button onClick={() => addToQueueAndPlay(song)} className="flex flex-1 items-center gap-3 text-left outline-none">
                              <img src={song.thumbnail} className={cn("aspect-video rounded-lg object-cover shadow-sm", compactQueue ? "w-[70px]" : "w-[100px]")} />
                              <div className="flex-1 overflow-hidden">
                                <p className={cn("truncate font-bold leading-tight text-foreground transition-colors", compactQueue ? "text-xs" : "text-sm")}>{song.title}</p>
                                <p className={cn("truncate font-medium text-muted-foreground transition-colors", compactQueue ? "text-[10px] mt-0" : "text-xs mt-0.5")}>{song.artist}</p>
                              </div>
                            </button>
                            {playlists.length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"><ListPlus className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-2xl z-[300]">
                                  <DropdownMenuItem disabled className="font-bold text-xs uppercase text-muted-foreground">Add to Playlist</DropdownMenuItem>
                                  {playlists.map(pl => (
                                    <DropdownMenuItem key={pl.id} onClick={() => addSongToPlaylist(pl.id, song)} className="font-semibold cursor-pointer rounded-xl py-2 text-foreground">{pl.name}</DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => toggleLike(song)} className="h-8 w-8 text-[var(--google-red)] hover:bg-[var(--google-red)]/10">
                              <Heart className="h-4 w-4 fill-current text-current transition-transform duration-500 hover:scale-110" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground px-2 font-medium">Like videos to see them here.</p>
                    )}
                  </div>
                 </div>
               </div>
            ) : (
              <div className="h-full w-full relative overflow-hidden" style={{ isolation: 'isolate', maskImage: 'linear-gradient(to bottom, black 0%, black 85%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 85%, transparent 100%)' }}>
                <div className="h-full w-full p-3 space-y-2 pb-32 animate-in slide-in-from-bottom-8 duration-700 ease-out overflow-y-auto overscroll-contain no-scrollbar">
                  {queue.length > 0 ? (
                  queue.map((song, index) => (
                    <div key={`${song.videoId}-${index}`} className={cn("group flex items-center gap-3 rounded-2xl transition-all duration-300 hover:bg-muted/80", index === currentIndex ? "bg-primary/5 shadow-sm border border-primary/10 scale-[1.02]" : "border border-transparent", compactQueue ? "p-1.5" : "p-2")}>
                      <button onClick={() => setCurrentIndex(index)} className="flex flex-1 items-center gap-4 text-left outline-none">
                        <div className={cn("relative flex-shrink-0 overflow-hidden rounded-lg shadow-sm aspect-video", compactQueue ? "w-[70px]" : "w-[100px]")}><img src={song.thumbnail} className="h-full w-full object-cover" /></div>
                        <div className="flex-1 overflow-hidden">
                          <p className={cn("truncate font-bold leading-tight", index === currentIndex ? "text-primary" : "text-foreground", compactQueue ? "text-xs" : "text-sm")}>{song.title}</p>
                          <p className={cn("truncate font-semibold text-muted-foreground mt-0.5", compactQueue ? "text-[10px]" : "text-xs")}>{song.artist}</p>
                        </div>
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => removeFromQueue(index)} className="h-10 w-10 rounded-full opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-destructive/10 text-destructive focus:opacity-100 outline-none"><X className="h-4 w-4 text-current" /></Button>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center"><ListMusic className="h-10 w-10 text-muted-foreground/40 mb-6" /><p className="font-extrabold text-xl mb-2 text-foreground">Queue is empty</p></div>
                )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- EXPANDABLE MOBILE PLAYER OVERLAY --- */}
      <div 
        className={cn(
          "fixed inset-0 z-[190] bg-black/60 backdrop-blur-sm transition-opacity duration-500 ease-out lg:hidden",
          isMobilePlayerExpanded ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsMobilePlayerExpanded(false)}
      />
      <div 
        className={cn(
          "fixed inset-x-0 bottom-0 z-[200] bg-background flex flex-col transition-transform duration-400 ease-out lg:hidden rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.3)]",
          isMobilePlayerExpanded ? "translate-y-0 h-[100dvh]" : "translate-y-[100%] h-[100dvh]"
        )}
      >
        <div className="flex items-center justify-between p-4 relative z-50 h-[72px]">
          <Button variant="ghost" size="icon" onClick={() => setIsMobilePlayerExpanded(false)} className="h-12 w-12 rounded-full hover:bg-muted text-foreground">
            <ChevronDown className="h-8 w-8 text-current" />
          </Button>
          <div className="flex bg-muted/50 rounded-full p-1 gap-1">
            <Button variant={mobilePlayerTab === 'player' ? 'default' : 'ghost'} size="sm" onClick={() => setMobilePlayerTab('player')} className="rounded-full px-4 font-bold text-xs text-foreground">Video</Button>
            <Button variant={mobilePlayerTab === 'queue' ? 'default' : 'ghost'} size="sm" onClick={() => setMobilePlayerTab('queue')} className="rounded-full px-4 font-bold text-xs text-foreground">Up Next</Button>
          </div>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
               <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full hover:bg-muted text-foreground">
                <MoreVertical className="h-6 w-6 text-current" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl animate-in fade-in zoom-in-95 duration-300 ease-out p-2 shadow-xl z-[400]">
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => setShowPlayerSettings(true), 100); }} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium text-foreground">
                <Settings className="h-4 w-4 text-muted-foreground text-current" /> Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 min-h-0 relative w-full z-0">
          
          {/* PLAYER TAB */}
          <div className={cn(
            "absolute inset-0 flex flex-col z-10 transition-opacity duration-300", 
            mobilePlayerTab === 'player' ? "opacity-100 pointer-events-auto overflow-y-auto no-scrollbar" : "opacity-0 pointer-events-none overflow-hidden"
          )}>
             {/* Space for the fixed video player */}
             <div className="w-full aspect-video shrink-0 pointer-events-none"></div>

             {currentSong && (
                <div className="p-6">
                  <div className="w-full flex items-start justify-between gap-4 mb-8">
                     <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-extrabold text-foreground mb-1">{currentSong.title}</h2>
                        <p className="text-base font-semibold text-muted-foreground">{currentSong.artist}</p>
                     </div>
                     <Button variant="ghost" size="icon" onClick={() => toggleLike(currentSong)} className="h-14 w-14 shrink-0 rounded-full text-foreground hover:bg-[var(--google-red)]/10">
                        <Heart className={cn("h-7 w-7 transition-all", likedSongs.has(currentSong.videoId) ? "fill-[var(--google-red)] text-[var(--google-red)] scale-110" : "text-current")} />
                     </Button>
                  </div>

                  <div className="bg-card rounded-[2rem] p-6 border shadow-sm flex flex-col gap-6">
                    <div className="flex items-center justify-between w-full">
                      <Button variant="ghost" size="icon" onClick={() => setShuffle(!shuffle)} className={cn("h-12 w-12 rounded-full", shuffle ? "bg-[var(--google-red)]/20 text-[var(--google-red)]" : "text-foreground")}><Shuffle className="h-6 w-6 text-current" /></Button>
                      <Button variant="ghost" size="icon" onClick={playPrevious} className="h-16 w-16 rounded-full text-foreground"><SkipBack className="h-8 w-8 fill-current" /></Button>
                      <Button onClick={togglePlay} className="h-20 w-20 rounded-full bg-[var(--google-red)] text-white shadow-xl hover:scale-105 transition-transform active:scale-95 flex items-center justify-center">
                         {isPlaying ? <Pause className="h-8 w-8 fill-current" /> : <Play className="h-8 w-8 fill-current translate-x-[2px]" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={playNext} className="h-16 w-16 rounded-full text-foreground"><SkipForward className="h-8 w-8 fill-current" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")} className={cn("h-12 w-12 rounded-full", repeatMode !== "off" ? "bg-[var(--google-red)]/20 text-[var(--google-red)]" : "text-foreground")}>
                        {repeatMode === "one" ? <Repeat1 className="h-6 w-6 text-current" /> : <Repeat className="h-6 w-6 text-current" />}
                      </Button>
                    </div>
                  </div>
                </div>
             )}
          </div>

          {/* QUEUE TAB */}
          <div 
            className={cn(
              "absolute inset-0 z-10 transition-opacity duration-300 overflow-hidden",
              mobilePlayerTab === 'queue' ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}
            style={{ isolation: 'isolate', maskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 85%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 85%, transparent 100%)' }}
          >
             <div className="h-full w-full overflow-y-auto overscroll-contain pb-32 pt-4 px-6 no-scrollbar">
               <h3 className="font-extrabold text-2xl mb-6 flex items-center gap-3 text-foreground"><ListMusic className="text-[var(--google-red)]"/> Up Next</h3>
               <div className="space-y-3">
                 {queue.map((song, index) => (
                   <div key={`${song.videoId}-${index}`} className={cn("group flex items-center gap-4 rounded-2xl transition-all duration-300", index === currentIndex ? "bg-primary/10 shadow-sm border border-primary/20" : "hover:bg-muted/80", compactQueue ? "p-2" : "p-3")}>
                     <button onClick={() => setCurrentIndex(index)} className="flex flex-1 items-center gap-4 text-left outline-none min-w-0">
                       <img src={song.thumbnail} className={cn("aspect-video rounded-lg object-cover shadow-sm flex-shrink-0", compactQueue ? "w-20" : "w-28")} />
                       <div className="flex-1 min-w-0 overflow-hidden">
                         <p className={cn("truncate font-bold", index === currentIndex ? "text-[var(--google-red)]" : "text-foreground", compactQueue ? "text-sm" : "text-base")}>{song.title}</p>
                         <p className={cn("truncate font-semibold text-muted-foreground mt-0.5", compactQueue ? "text-xs" : "text-sm")}>{song.artist}</p>
                       </div>
                     </button>
                     <Button variant="ghost" size="icon" onClick={() => removeFromQueue(index)} className="h-12 w-12 rounded-full text-destructive bg-destructive/10 hover:bg-destructive/20"><X className="h-5 w-5 text-current" /></Button>
                   </div>
                 ))}
               </div>
             </div>
          </div>

        </div>
      </div>

      {/* --- SETTINGS & DIALOGS --- */}
      <Dialog open={showPlayerSettings} onOpenChange={setShowPlayerSettings}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-0 border-0 shadow-2xl animate-in zoom-in-95 duration-500 ease-out outline-none overflow-hidden bg-background !z-[400]">
          <div className="flex items-center gap-4 p-5 border-b bg-card/50 backdrop-blur-sm">
            <Button variant="ghost" size="icon" onClick={() => setShowPlayerSettings(false)} className="rounded-full text-foreground"><ArrowLeft className="w-6 h-6 text-current"/></Button>
            <h2 className="text-xl font-bold text-foreground">Settings</h2>
          </div>
          <div className="p-2 overflow-y-auto max-h-[70vh] no-scrollbar pb-10">
             
             {/* Appearance Settings */}
             <div className="px-4 py-2 space-y-1">
               <h3 className="text-[13px] font-bold text-primary mb-4 ml-2">Appearance</h3>
               
               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><Palette className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-semibold text-base text-foreground">Dynamic theme</span>
                     <span className="text-xs font-normal text-muted-foreground">Extracts colors from the active video.</span>
                   </div>
                 </div>
                 <Switch checked={dynamicTheme} onCheckedChange={setDynamicTheme} className="shrink-0" />
               </div>
               
               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setIsDark(!isDark)}>
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><Moon className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-bold text-base text-foreground">Dark mode</span>
                     <span className="text-xs font-normal text-muted-foreground">Toggle application theme.</span>
                   </div>
                 </div>
                 <Switch checked={isDark} onCheckedChange={setIsDark} className="shrink-0 pointer-events-none" />
               </div>

               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><Activity className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-bold text-base text-foreground">Reduce motion</span>
                     <span className="text-xs font-normal text-muted-foreground">Disables player scale animations.</span>
                   </div>
                 </div>
                 <Switch checked={reduceMotion} onCheckedChange={(val) => { setReduceMotion(val); localStorage.setItem('ganvo_reduce_motion', val.toString()) }} className="shrink-0" />
               </div>

               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><Rows3 className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-bold text-base text-foreground">Compact queue layout</span>
                     <span className="text-xs font-normal text-muted-foreground">Shrink queue items to show more per page.</span>
                   </div>
                 </div>
                 <Switch checked={compactQueue} onCheckedChange={(val) => { setCompactQueue(val); localStorage.setItem('ganvo_compact_queue', val.toString()) }} className="shrink-0" />
               </div>
             </div>
             
             {/* Player Settings */}
             <div className="px-4 py-4 space-y-1">
               <h3 className="text-[13px] font-bold text-primary mb-4 ml-2">Player View</h3>
               
               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><LayoutTemplate className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-bold text-base text-foreground">Background style</span>
                     <span className="text-xs font-normal text-muted-foreground">How the background renders.</span>
                   </div>
                 </div>
                 <Select disabled={!dynamicTheme} value={playerBgStyle} onValueChange={(v: any) => setPlayerBgStyle(v)}>
                    <SelectTrigger className="w-[110px] rounded-xl font-bold bg-muted border-none text-foreground text-xs h-9 shrink-0 outline-none focus:ring-0">
                      <SelectValue placeholder="Style" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl z-[500]">
                      <SelectItem value="Theme" className="font-bold py-2 text-xs">Follow theme</SelectItem>
                      <SelectItem value="Gradient" className="font-bold py-2 text-xs">Gradient</SelectItem>
                      <SelectItem value="Blur" className="font-bold py-2 text-xs">Blur</SelectItem>
                    </SelectContent>
                  </Select>
               </div>

               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><Maximize2 className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-semibold text-base text-foreground">Auto-switch to player</span>
                     <span className="text-xs font-normal text-muted-foreground">Jump to Player tab when selecting a video.</span>
                   </div>
                 </div>
                 <Switch checked={autoSwitchToPlayer} onCheckedChange={(val) => { setAutoSwitchToPlayer(val); localStorage.setItem('ganvo_auto_switch_player', val.toString()) }} className="shrink-0" />
               </div>
             </div>
             
             {/* Data Settings */}
             <div className="px-4 py-4 space-y-1">
               <h3 className="text-[13px] font-bold text-primary mb-4 ml-2">Data & Privacy</h3>
               
               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><History className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-semibold text-base text-foreground">Save search history</span>
                     <span className="text-xs font-normal text-muted-foreground">Remember your previous searches.</span>
                   </div>
                 </div>
                 <Switch checked={saveSearchHistory} onCheckedChange={(val) => { setSaveSearchHistory(val); localStorage.setItem('ganvo_save_history', val.toString()) }} className="shrink-0" />
               </div>

               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-destructive/10 transition-colors text-destructive" onClick={() => { if(window.confirm("Clear all app preferences and search history? Your cloud playlists will not be deleted.")) { localStorage.clear(); window.location.reload(); } }}>
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-destructive/10 rounded-full text-current"><Trash2 className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-bold text-base text-current">Clear all local data</span>
                     <span className="text-xs font-normal opacity-80">Resets settings and search history.</span>
                   </div>
                 </div>
               </div>
             </div>

          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-8 border-0 shadow-2xl animate-in zoom-in-95 duration-500 ease-out outline-none bg-background !z-[400]">
          <DialogHeader>
            <div className="mb-6 flex justify-center"><div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-primary/10 text-primary"><UserCircle2 className="h-10 w-10 text-current" /></div></div>
            <DialogTitle className="text-2xl font-extrabold text-center text-foreground">Account Sync</DialogTitle>
            <DialogDescription className="font-medium text-center mt-2">Sign in to save your playlists and liked videos to the cloud.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEmailAuth} className="space-y-4 mt-2">
            <div className="space-y-3">
              <Input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required className="h-14 rounded-2xl bg-muted/50 border-transparent focus-visible:ring-primary font-medium px-4 text-foreground" />
              <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="h-14 rounded-2xl bg-muted/50 border-transparent focus-visible:ring-primary font-medium px-4 text-foreground" />
            </div>
            {authError && <p className="text-xs font-bold text-destructive text-center p-3 bg-destructive/10 rounded-xl">{authError}</p>}
            <Button type="submit" className="w-full h-14 rounded-2xl font-bold text-base shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] text-white bg-[var(--google-red)]">{isSignUp ? "Create Account" : "Sign In"}</Button>
            <div className="flex items-center gap-2 my-4"><div className="flex-1 h-px bg-border"></div><span className="text-xs font-bold text-muted-foreground uppercase">OR</span><div className="flex-1 h-px bg-border"></div></div>
            <Button type="button" variant="outline" onClick={handleGoogleSignIn} className="w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-3">Continue with Google</Button>
            <p className="text-sm text-center font-bold text-primary mt-4 cursor-pointer hover:underline" onClick={() => {setIsSignUp(!isSignUp); setAuthError("")}}>{isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}</p>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAccountSettings} onOpenChange={setShowAccountSettings}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-8 border-0 shadow-2xl bg-background !z-[400]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold flex items-center gap-3 text-foreground"><UserCircle2 className="h-6 w-6 text-primary"/> Account Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile} className="space-y-6 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-bold ml-1 text-muted-foreground">Display Name</label>
              <Input value={displayNameInput} onChange={e => setDisplayNameInput(e.target.value)} placeholder="Your Name" className="h-14 rounded-2xl bg-muted/50 border-transparent font-bold px-4 text-lg" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold ml-1 text-muted-foreground">Email Address</label>
              <Input value={user?.email || ""} disabled className="h-14 rounded-2xl bg-muted/30 border-transparent font-medium px-4 opacity-70" />
            </div>
            <Button type="submit" className="w-full h-14 rounded-2xl font-bold text-base shadow-lg text-white bg-[var(--google-red)]">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showPlaylistDialog} onOpenChange={setShowPlaylistDialog}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-8 border-0 shadow-2xl bg-background !z-[400]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold flex items-center gap-3 text-foreground"><ListPlus className="h-6 w-6 text-primary"/> New Playlist</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePlaylist} className="space-y-6 mt-4">
            <div className="space-y-2">
              <Input value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder="Playlist Name" autoFocus required className="h-14 rounded-2xl bg-muted/50 border-transparent font-bold px-4 text-lg" />
            </div>
            <Button type="submit" className="w-full h-14 rounded-2xl font-bold text-base shadow-lg text-white bg-[var(--google-red)]">Create Playlist</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAboutDialog} onOpenChange={setShowAboutDialog}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-6 sm:p-8 border-0 shadow-2xl bg-background !z-[400]">
          <DialogHeader>
            <div className="mb-5 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-[var(--google-red)] shadow-lg"><Video className="h-8 w-8 text-white fill-current" /></div>
              <div>
                <DialogTitle className="text-2xl font-extrabold tracking-tight text-foreground">VideoPlayer</DialogTitle>
                <DialogDescription className="font-semibold mt-1">Version 2.0.0</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 text-sm font-medium text-muted-foreground leading-relaxed mt-2">
            <p>A modern video player utilizing standard YouTube APIs with unified seamless playback layers and fluid PIP support.</p>
            <div className="flex flex-col gap-2 mt-4 bg-muted/30 p-4 rounded-2xl">
              <div>
                <h4 className="font-bold text-foreground mb-1">Terms of Service</h4>
                <p className="text-xs">By using this service, you agree to respect the intellectual property of the creators. This app is for personal, non-commercial use only.</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
