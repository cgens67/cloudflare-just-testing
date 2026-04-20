import { NextResponse } from 'next/server'
import YTMusic from 'ytmusic-api'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ytmusic = new YTMusic()
let initialized = false

async function ensureInitialized() {
  if (!initialized) {
    await ytmusic.initialize()
    initialized = true
  }
}

const formatThumb = (thumbnails: any[]) => {
  let url = thumbnails?.[thumbnails.length - 1]?.url || ''
  if (url.includes('=w') || url.includes('-w')) {
    url = url.replace(/([=-]w)\d+([=-]h)\d+.*/, '$11200$21200-c')
  }
  return url
}

export async function GET() {
  try {
    await ensureInitialized()
    
    // Fetch categories and specific creator top picks concurrently
    const [artistsRes, songsRes, albumsRes] = await Promise.all([
      ytmusic.searchArtists("Top Global Artists"),
      ytmusic.searchSongs("Top Global Hits"),
      ytmusic.searchAlbums("Top Albums 2024")
    ])
    
    const picksIds =['M_DiTjNBiOY', 'nmbiBVPe5bY', 'p9OtySpRRL8', 'iHsObIWkM-s', '_2qJy5r-WAY', 'M2dgm4xK3IY', 'DntZ3-yCaFs', '-KrC-gqKTMg']
    const picksData = await Promise.all(picksIds.map(id => ytmusic.getSong(id).catch(() => null)))
    
    const creatorsPicks = picksData.filter(Boolean).map(s => ({
      videoId: s.videoId,
      title: s.name,
      artist: s.artist?.name || 'Unknown Artist',
      artistId: s.artist?.artistId || null,
      album: s.album?.name || '',
      duration: s.duration || 0,
      thumbnail: formatThumb(s.thumbnails)
    }))
    
    const artists = artistsRes.slice(0, 15).map(a => ({
      artistId: a.artistId,
      name: a.name,
      subscribers: a.subscribers || 'Popular',
      thumbnail: formatThumb(a.thumbnails)
    }))

    const songs = songsRes.slice(0, 15).map(s => ({
      videoId: s.videoId,
      title: s.name,
      artist: s.artist?.name || 'Unknown Artist',
      artistId: s.artist?.artistId || null,
      album: s.album?.name || '',
      duration: s.duration || 0,
      thumbnail: formatThumb(s.thumbnails)
    }))

    const albums = albumsRes.slice(0, 15).map(a => ({
      albumId: a.albumId || a.id,
      title: a.name,
      artist: a.artist?.name || 'Unknown Artist',
      year: a.year || '',
      thumbnail: formatThumb(a.thumbnails)
    }))

    return NextResponse.json({ creatorsPicks, artists, songs, albums })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch explore data' }, { status: 500 })
  }
}
