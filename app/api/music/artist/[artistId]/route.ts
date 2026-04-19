import { NextRequest, NextResponse } from 'next/server'
import YTMusic from 'ytmusic-api'

const ytmusic = new YTMusic()
let initialized = false

async function ensureInitialized() {
  if (!initialized) {
    await ytmusic.initialize()
    initialized = true
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artistId: string }> }
) {
  const { artistId } = await params
  if (!artistId) return NextResponse.json({ error: 'Artist ID required' }, { status: 400 })

  try {
    await ensureInitialized()
    const artistData = await ytmusic.getArtist(artistId)
    
    const formatThumbnail = (thumbnails: any[]) => {
      let url = thumbnails?.[thumbnails.length - 1]?.url || ''
      if (url.includes('=w') || url.includes('-w')) {
        url = url.replace(/([=-]w)\d+([=-]h)\d+.*/, '$11200$21200-c')
      }
      return url
    }

    const topSongs = (artistData.topSongs ||[]).map((song) => ({
      videoId: song.videoId,
      title: song.name,
      artist: artistData.name,
      artistId: artistId,
      album: song.album?.name || '',
      duration: song.duration || 0,
      thumbnail: formatThumbnail(song.thumbnails),
    }))

    const albums = (artistData.albums ||[]).map((album) => ({
      browseId: album.browseId,
      title: album.title,
      year: album.year,
      thumbnail: formatThumbnail(album.thumbnails)
    }))

    const singles = (artistData.singles ||[]).map((single) => ({
      browseId: single.browseId,
      title: single.title,
      year: single.year,
      thumbnail: formatThumbnail(single.thumbnails)
    }))

    return NextResponse.json({ 
      name: artistData.name,
      description: artistData.description,
      subscribers: artistData.subscribers,
      thumbnails: artistData.thumbnails,
      topSongs,
      albums,
      singles
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch artist' }, { status: 500 })
  }
}
