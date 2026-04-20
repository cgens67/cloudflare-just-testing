import { NextRequest, NextResponse } from 'next/server'

const PIPED_INSTANCES =[
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
  'https://pipedapi.leptons.xyz',
  'https://piped-api.privacy.com.de',
  'https://pipedapi.owo.si'
]

const INVIDIOUS_INSTANCES =[
  'https://inv.tux.pizza',
  'https://invidious.asir.dev',
  'https://invidious.protokolla.fi',
  'https://vid.puffyan.us'
]

async function tryPiped(videoId: string, instance: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(`${instance}/streams/${videoId}`, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!response.ok) return null
    const data = await response.json()
    const audioStreams = (data.audioStreams ||[])
      .filter((s: any) => s.url && s.mimeType?.includes('audio'))
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))
    if (audioStreams.length > 0) return { audioUrl: audioStreams[0].url, duration: data.duration || 0, source: 'piped' }
  } catch { return null }
}

async function tryInvidious(videoId: string, instance: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(`${instance}/api/v1/videos/${videoId}`, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!response.ok) return null
    const data = await response.json()
    if (data.formatStreams) {
      const audio = data.formatStreams.find((s: any) => s.type.includes('audio/mp4') || s.type.includes('audio/webm'))
      if (audio && audio.url) return { audioUrl: audio.url, duration: data.lengthSeconds || 0, source: 'invidious' }
    }
  } catch { return null }
}

async function tryCobalt(videoId: string) {
  try {
    const res = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        aFormat: 'mp3',
        isAudioOnly: true,
        downloadMode: 'audio'
      })
    })
    if (res.ok) {
      const data = await res.json()
      if (data.url) return { audioUrl: data.url, duration: 0, source: 'cobalt' }
    }
  } catch { return null }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params
  if (!videoId) return NextResponse.json({ error: 'Video ID required' }, { status: 400 })

  const promises =[
    tryCobalt(videoId),
    ...PIPED_INSTANCES.map(i => tryPiped(videoId, i)),
    ...INVIDIOUS_INSTANCES.map(i => tryInvidious(videoId, i))
  ]

  try {
    const result = await Promise.any(promises.map(async p => {
      const res = await p
      if (res && res.audioUrl) return res
      throw new Error('Not found')
    }))
    if (result) return NextResponse.json(result)
  } catch (e) {}

  return NextResponse.json({ error: 'Could not find audio stream. The song may be unavailable.' }, { status: 404 })
}
