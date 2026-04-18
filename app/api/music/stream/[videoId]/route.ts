import { NextRequest, NextResponse } from 'next/server'

// Multiple API sources for audio streaming - try all until one works
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://vid.puffyan.us',
  'https://invidious.snopyta.org',
  'https://invidious.kavin.rocks',
]

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.syncpundit.io',
  'https://api.piped.yt',
  'https://pipedapi.in.projectsegfau.lt',
  'https://watchapi.whatever.social',
]

async function tryInvidiousStream(videoId: string): Promise<{ audioUrl: string; duration: number } | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)
      
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) continue

      const data = await response.json()
      
      // Find the best audio stream from adaptiveFormats
      const audioFormats = (data.adaptiveFormats || [])
        .filter((format: { type: string }) => format.type?.startsWith('audio/'))
        .sort((a: { bitrate: number }, b: { bitrate: number }) => (b.bitrate || 0) - (a.bitrate || 0))

      if (audioFormats.length > 0) {
        return {
          audioUrl: audioFormats[0].url,
          duration: data.lengthSeconds || 0,
        }
      }
    } catch (error) {
      console.log(`[v0] Invidious instance ${instance} failed:`, error)
      continue
    }
  }
  return null
}

async function tryPipedStream(videoId: string): Promise<{ audioUrl: string; duration: number } | null> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)
      
      const response = await fetch(`${instance}/streams/${videoId}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) continue

      const data = await response.json()
      
      // Find the best audio stream
      const audioStreams = (data.audioStreams || [])
        .filter((stream: { mimeType: string }) => stream.mimeType?.includes('audio'))
        .sort((a: { bitrate: number }, b: { bitrate: number }) => (b.bitrate || 0) - (a.bitrate || 0))

      if (audioStreams.length > 0) {
        return {
          audioUrl: audioStreams[0].url,
          duration: data.duration || 0,
        }
      }
    } catch (error) {
      console.log(`[v0] Piped instance ${instance} failed:`, error)
      continue
    }
  }
  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params

  try {
    // Try Invidious first, then Piped
    let result = await tryInvidiousStream(videoId)
    
    if (!result) {
      result = await tryPipedStream(videoId)
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Could not find audio stream from any source. Please try another song.' },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[v0] Stream error:', error)
    return NextResponse.json(
      { error: 'Failed to get audio stream' },
      { status: 500 }
    )
  }
}
