import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// A robust list of Invidious proxies that bypass YouTube IP blocks
const INVIDIOUS_INSTANCES =[
  'https://inv.tux.pizza',
  'https://invidious.asir.dev',
  'https://invidious.protokolla.fi',
  'https://vid.puffyan.us',
  'https://inv.nadeko.net',
  'https://invidious.privacydev.net'
]

// A robust list of Piped instances
const PIPED_INSTANCES =[
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.syncpundit.io',
  'https://api-piped.mha.fi',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
  'https://pipedapi.smnz.de'
]

async function tryPipedStream(videoId: string, instance: string): Promise<{ audioUrl: string; duration: number; source: string }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3500)
  
  try {
    const response = await fetch(`${instance}/streams/${videoId}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    })
    clearTimeout(timeoutId)
    
    if (!response.ok) throw new Error('Piped instance returned error')
    
    const data = await response.json()
    const audioStreams = (data.audioStreams ||[])
      .filter((stream: any) => stream.url && stream.mimeType?.includes('audio'))
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))

    if (audioStreams.length > 0) {
      return { audioUrl: audioStreams[0].url, duration: data.duration || 0, source: 'piped' }
    }
  } catch (e) {
    clearTimeout(timeoutId)
  }
  throw new Error('Piped failed')
}

async function tryInvidiousStream(videoId: string, instance: string): Promise<{ audioUrl: string; duration: number; source: string }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3500)
  
  try {
    const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    })
    clearTimeout(timeoutId)
    
    if (!response.ok) throw new Error('Invidious instance returned error')
    
    const data = await response.json()
    if (data.lengthSeconds) {
      return {
        // Using local=true forces the server to proxy the stream, avoiding YouTube's IP blocks
        audioUrl: `${instance}/latest_version?id=${videoId}&itag=140&local=true`,
        duration: data.lengthSeconds,
        source: 'invidious'
      }
    }
  } catch (e) {
    clearTimeout(timeoutId)
  }
  throw new Error('Invidious failed')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
  }

  // Launch all requests concurrently.
  // Promise.any will return the FIRST successful response and immediately ignore the rest.
  const promises =[
    ...PIPED_INSTANCES.map(inst => tryPipedStream(videoId, inst)),
    ...INVIDIOUS_INSTANCES.map(inst => tryInvidiousStream(videoId, inst))
  ];

  try {
    const fastestResult = await Promise.any(promises);
    return NextResponse.json(fastestResult);
  } catch (error) {
    return NextResponse.json(
      { error: 'Could not find audio stream. This song may be region-restricted or unavailable.' },
      { status: 404 }
    )
  }
}
