import { NextResponse } from 'next/server'
import YTMusic from 'ytmusic-api'

const ytmusic = new YTMusic()
let initialized = false

async function ensureInitialized() {
  if (!initialized) {
    await ytmusic.initialize()
    initialized = true
  }
}

export async function GET() {
  try {
    await ensureInitialized()
    // Searches for top global artists
    const results = await ytmusic.searchArtists("Top Pop Artists")
    
    const artists = results.slice(0, 15).map((artist) => {
      let thumbUrl = artist.thumbnails?.[artist.thumbnails.length - 1]?.url || ''
      if (thumbUrl.includes('=w') || thumbUrl.includes('-w')) {
        thumbUrl = thumbUrl.replace(/([=-]w)\d+([=-]h)\d+/, '$1800$2800')
      }
      return {
        artistId: artist.artistId,
        name: artist.name,
        subscribers: artist.subscribers || 'Popular',
        thumbnail: thumbUrl
      }
    })

    return NextResponse.json({ artists })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch artists' }, { status: 500 })
  }
}
