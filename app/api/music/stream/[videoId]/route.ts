import { NextRequest, NextResponse } from 'next/server'

const PIPED_INSTANCES =[
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
  'https://pipedapi.leptons.xyz',
  'https://piped-api.privacy.com.de',
  'https://pipedapi.owo.si',
]

const INVIDIOUS_INSTANCES =[
  'https://vid.puffyan.us',
  'https://inv.tux.pizza',
  'https://invidious.asir.dev',
  'https://invidious.protokolla.fi',
]

async function tryPipedStream(videoId: string, instance: string): Promise<{ audioUrl: string; duration: number; instance: string } | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    
    const response = await fetch(`${instance}/streams/${videoId}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) return null

    const data = await response.json()
    
    const audioStreams = (data.audioStreams ||[])
      .filter((stream: { url?: string; mimeType?: string }) => stream.url && stream.mimeType?.includes('audio'))
      .sort((a: { bitrate?: number }, b: { bitrate?: number }) => (b.bitrate || 0) - (a.bitrate || 0))

    if (audioStreams.length > 0) {
      return {
        audioUrl: audioStreams[0].url,
        duration: data.duration || 0,
        instance,
      }
    }
    
    return null
  } catch {
    return null
  }
}

async function tryInvidiousStream(videoId: string, instance: string): Promise<{ audioUrl: string; duration: number; instance: string } | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    
    const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) return null

    const data = await response.json()
    
    const audioStreams = (data.adaptiveFormats ||[])
      .filter((stream: { type?: string; url?: string }) => stream.url && stream.type?.includes('audio'))
      .sort((a: { bitrate?: string }, b: { bitrate?: string }) => (parseInt(b.bitrate || '0')) - (parseInt(a.bitrate || '0')))

    if (audioStreams.length > 0) {
      return {
        audioUrl: audioStreams[0].url,
        duration: data.lengthSeconds || 0,
        instance,
      }
    }
    
    return null
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
  }

  // 1. Try all Piped instances in parallel for faster response
  const pipedResults = await Promise.allSettled(
    PIPED_INSTANCES.map(instance => tryPipedStream(videoId, instance))
  )

  for (const result of pipedResults) {
    if (result.status === 'fulfilled' && result.value) {
      return NextResponse.json(result.value)
    }
  }

  // 2. If Piped fails (e.g. region blocked), try Invidious instances as a robust fallback
  const invidiousResults = await Promise.allSettled(
    INVIDIOUS_INSTANCES.map(instance => tryInvidiousStream(videoId, instance))
  )

  for (const result of invidiousResults) {
    if (result.status === 'fulfilled' && result.value) {
      return NextResponse.json(result.value)
    }
  }

  return NextResponse.json(
    { error: 'Could not find audio stream. This song may be region-restricted or unavailable.' },
    { status: 404 }
  )
}
