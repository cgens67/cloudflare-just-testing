import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Invidious streams files actively mapped through proxies ignoring localized 
// Youtube network IP boundaries which successfully masks standard extraction parameters.
const INVIDIOUS_INSTANCES =[
  'https://inv.tux.pizza',
  'https://invidious.nerdvpn.de',
  'https://inv.nadeko.net',
  'https://vid.puffyan.us',
  'https://invidious.perennialte.ch'
]

export async function GET(request: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params

  if (!videoId) return NextResponse.json({ error: 'Video ID required' }, { status: 400 })

  const checkInvidious = async (instance: string) => {
     // Run generic health checks on proxy endpoints.
     const controller = new AbortController()
     const timeout = setTimeout(() => controller.abort(), 3500)
     try {
       const res = await fetch(`${instance}/api/v1/videos/${videoId}`, { signal: controller.signal })
       clearTimeout(timeout)
       if (res.ok) {
           const json = await res.json()
           // local=true delegates stream tunneling correctly bypassing YouTube CDN bounds securely 
           if (json.lengthSeconds) {
              return `${instance}/latest_version?id=${videoId}&itag=140&local=true`
           }
       }
       throw new Error()
     } catch {
       throw new Error()
     }
  }

  try {
     const audioUrl = await Promise.any(INVIDIOUS_INSTANCES.map(i => checkInvidious(i)))
     if (audioUrl) {
        return NextResponse.json({ audioUrl, duration: 0, source: 'invidious-proxy' })
     }
  } catch (e) {}

  // Last-Ditch robust instance manually forwarded if server proxy requests drop
  return NextResponse.json({
    audioUrl: `https://invidious.nerdvpn.de/latest_version?id=${videoId}&itag=140&local=true`,
    duration: 0, 
    source: 'fallback-proxy'
  })
}
