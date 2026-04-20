import { NextRequest, NextResponse } from 'next/server'
import { Innertube } from 'youtubei.js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache the Innertube instance to avoid re-creating it on every request
let innertubeInstance: Awaited<ReturnType<typeof Innertube.create>> | null = null

async function getInnertube() {
  if (!innertubeInstance) {
    innertubeInstance = await Innertube.create({
      generate_session_locally: true,
    })
  }
  return innertubeInstance
}

async function tryInnertube(videoId: string, quality: string) {
  try {
    const yt = await getInnertube()
    const info = await yt.getInfo(videoId)
    const streamingData = info.streaming_data

    if (!streamingData) return null

    // Gather all audio-only adaptive formats
    const audioFormats = [
      ...(streamingData.adaptive_formats ?? []),
    ].filter((f: any) => {
      const mime: string = f.mime_type ?? ''
      return mime.startsWith('audio/') && f.url
    })

    if (audioFormats.length === 0) return null

    // Sort by bitrate according to quality preference
    audioFormats.sort((a: any, b: any) => {
      const aBitrate = a.average_bitrate ?? a.bitrate ?? 0
      const bBitrate = b.average_bitrate ?? b.bitrate ?? 0
      return quality === 'Low' ? aBitrate - bBitrate : bBitrate - aBitrate
    })

    const best = audioFormats[0] as any
    const audioUrl: string = best.url

    const duration: number = info.basic_info?.duration ?? 0

    return { audioUrl, duration, source: 'innertube' }
  } catch (e) {
    // If the cached instance is stale, reset it and let fallbacks take over
    innertubeInstance = null
    return null
  }
}

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.yt',
  'https://pipedapi.adminforge.de',
]

const INVIDIOUS_INSTANCES = [
  'https://inv.tux.pizza',
  'https://invidious.asir.dev',
  'https://invidious.protokolla.fi',
  'https://inv.nadeko.net',
  'https://invidious.privacydev.net',
]

async function tryPiped(videoId: string, instance: string, quality: string) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`${instance}/streams/${videoId}`, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const data = await res.json()
    const audioStreams = (data.audioStreams ?? [])
      .filter((s: any) => s.url && s.mimeType?.includes('audio'))
      .sort((a: any, b: any) =>
        quality === 'Low'
          ? (a.bitrate ?? 0) - (b.bitrate ?? 0)
          : (b.bitrate ?? 0) - (a.bitrate ?? 0)
      )
    if (audioStreams.length > 0) {
      return { audioUrl: audioStreams[0].url, duration: data.duration ?? 0, source: 'piped' }
    }
  } catch { /* ignore */ }
  return null
}

async function tryInvidious(videoId: string, instance: string) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`${instance}/api/v1/videos/${videoId}`, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const data = await res.json()
    if (data.lengthSeconds) {
      const audio = data.formatStreams?.find(
        (s: any) => s.type?.includes('audio/mp4') || s.type?.includes('audio/webm')
      )
      if (audio?.url) {
        return { audioUrl: audio.url, duration: data.lengthSeconds ?? 0, source: 'invidious-direct' }
      }
      return {
        audioUrl: `${instance}/latest_version?id=${videoId}&itag=140&local=true`,
        duration: data.lengthSeconds ?? 0,
        source: 'invidious-proxy',
      }
    }
  } catch { /* ignore */ }
  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params
  const quality = request.nextUrl.searchParams.get('quality') ?? 'High'

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID required' }, { status: 400 })
  }

  // 1. InnerTube (youtubei.js) — most reliable, direct from YouTube
  const innertubeResult = await tryInnertube(videoId, quality)
  if (innertubeResult) return NextResponse.json(innertubeResult)

  // 2. Piped instances — race them all
  const pipedResults = await Promise.allSettled(
    PIPED_INSTANCES.map((i) => tryPiped(videoId, i, quality))
  )
  for (const r of pipedResults) {
    if (r.status === 'fulfilled' && r.value?.audioUrl) {
      return NextResponse.json(r.value)
    }
  }

  // 3. Invidious instances — race them all
  const invidiousResults = await Promise.allSettled(
    INVIDIOUS_INSTANCES.map((i) => tryInvidious(videoId, i))
  )
  for (const r of invidiousResults) {
    if (r.status === 'fulfilled' && r.value?.audioUrl) {
      return NextResponse.json(r.value)
    }
  }

  return NextResponse.json(
    { error: 'Could not find audio stream. The song may be unavailable or region-restricted.' },
    { status: 404 }
  )
}
