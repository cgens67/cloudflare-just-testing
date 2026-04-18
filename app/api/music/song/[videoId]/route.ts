import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const INVIDIOUS_INSTANCES =[
  'https://inv.tux.pizza',
  'https://invidious.asir.dev',
  'https://invidious.protokolla.fi',
  'https://vid.puffyan.us'
]

const PIPED_INSTANCES =[
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
  'https://pipedapi.leptons.xyz',
  'https://piped-api.privacy.com.de',
  'https://pipedapi.owo.si',
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
  }

  // 1. Try Cobalt API (Highly Reliable, acts as a direct scraper)
  try {
    const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        aFormat: 'mp3',
        isAudioOnly: true
      })
    })
    
    if (cobaltRes.ok) {
      const cobaltData = await cobaltRes.json()
      if (cobaltData.url) {
        return NextResponse.json({ audioUrl: cobaltData.url, duration: 0, source: 'cobalt' })
      }
    }
  } catch (e) {
    console.error('Cobalt fallback failed', e)
  }

  // 2. Try Invidious Proxy Streams (Highly Reliable Proxy bypassing IP blocks)
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(`${instance}/api/v1/videos/${videoId}`, { signal: controller.signal })
      clearTimeout(timeout)
      
      if (res.ok) {
        const data = await res.json()
        if (data.lengthSeconds) {
          return NextResponse.json({
            // local=true forces the Invidious instance to proxy the audio stream, bypassing client IP restrictions
            audioUrl: `${instance}/latest_version?id=${videoId}&itag=140&local=true`,
            duration: data.lengthSeconds,
            source: 'invidious'
          })
        }
      }
    } catch (e) { continue }
  }

  // 3. Fallback to Piped Instances
  for (const instance of PIPED_INSTANCES) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(`${instance}/streams/${videoId}`, { signal: controller.signal })
      clearTimeout(timeout)
      
      if (res.ok) {
        const data = await res.json()
        const audioStreams = (data.audioStreams ||[])
          .filter((s: any) => s.url && s.mimeType?.includes('audio'))
          .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))
          
        if (audioStreams.length > 0) {
          return NextResponse.json({
            audioUrl: audioStreams[0].url,
            duration: data.duration || 0,
            source: 'piped'
          })
        }
      }
    } catch (e) { continue }
  }

  return NextResponse.json(
    { error: 'Could not find audio stream. This song may be region-restricted or unavailable.' },
    { status: 404 }
  )
}
