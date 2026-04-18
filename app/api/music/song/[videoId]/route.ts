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
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params

  try {
    await ensureInitialized()
    const song = await ytmusic.getSong(videoId)

    const rawThumbnail = song.thumbnails?.[song.thumbnails.length - 1]?.url || '';
    const crispThumbnail = rawThumbnail.replace(/([=\-])w\d+-h\d+.*$/, '$1w1080-h1080-l90-rj');
    
    return NextResponse.json({
      videoId: song.videoId,
      title: song.name,
      artist: song.artist?.name || 'Unknown Artist',
      album: song.album?.name || '',
      duration: song.duration || 0,
      thumbnail: crispThumbnail,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Failed to get song:', error)
    return NextResponse.json({ error: 'Failed to get song details' }, { status: 500 })
  }
}
