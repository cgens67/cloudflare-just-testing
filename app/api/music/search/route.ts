import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const PIPED_INSTANCES =[
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.syncpundit.io',
  'https://piped-api.garudalinux.org'
]

const INVIDIOUS_INSTANCES =[
  'https://invidious.weblibre.org',
  'https://invidious.jing.rocks',
  'https://vid.puffyan.us',
  'https://invidious.nerdvpn.de'
]

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  let videos =[]

  // 1. Try Piped API Instances
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}/search?q=${encodeURIComponent(query)}&filter=videos`, { next: { revalidate: 3600 } })
      if (!res.ok) continue
      const data = await res.json()
      videos = data.items.map((v: any) => ({
        videoId: v.url.split('?v=')[1],
        title: v.title,
        artist: v.uploaderName, 
        album: `${v.viewCount?.toLocaleString() || 0} views`, 
        duration: v.duration,
        thumbnail: v.thumbnail,
      }))
      if (videos.length > 0) return NextResponse.json({ results: videos })
    } catch (e) {
      continue
    }
  }

  // 2. Try Invidious API Instances (Fallback)
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, { next: { revalidate: 3600 } })
      if (!res.ok) continue
      const data = await res.json()
      videos = data.map((v: any) => ({
        videoId: v.videoId,
        title: v.title,
        artist: v.author, 
        album: `${v.viewCount?.toLocaleString() || 0} views`, 
        duration: v.lengthSeconds,
        thumbnail: v.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url || v.videoThumbnails?.[0]?.url || '',
      }))
      if (videos.length > 0) return NextResponse.json({ results: videos })
    } catch (e) {
      continue
    }
  }

  return NextResponse.json({ error: 'All instances failed' }, { status: 500 })
}
