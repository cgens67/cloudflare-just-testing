import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Updated list of active Piped instances
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
  'https://pipedapi.leptons.xyz',
  'https://piped-api.privacy.com.de',
  'https://pipedapi.reallyaweso.me',
  'https://pipedapi.drgns.space',
  'https://pipedapi.owo.si',
  'https://piped-api.codespace.cz',
  'https://api.piped.private.coffee',
]

async function tryPipedStream(videoId: string, instance: string) {
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
    
    const audioStreams = (data.audioStreams || [])
      .filter((stream: any) => stream.url && stream.mimeType?.includes('audio'))
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))

    if (audioStreams.length > 0) {
      return { audioUrl: audioStreams[0].url, duration: data.duration || 0 }
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
  if (!videoId) return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })

  // Sequential try to ensure stability (your original working logic)
  for (const instance of PIPED_INSTANCES) {
    const result = await tryPipedStream(videoId, instance)
    if (result) return NextResponse.json(result)
  }

  return NextResponse.json(
    { error: 'Could not find audio stream. This song may be region-restricted or unavailable.' },
    { status: 404 }
  )
}
