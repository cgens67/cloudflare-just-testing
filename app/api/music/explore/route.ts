import { NextResponse } from 'next/server'

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

export async function GET() {
  let trending =[]

  // 1. Try Piped API Instances
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}/trending?region=US`, { next: { revalidate: 3600 } })
      if (!res.ok) continue
      const data = await res.json()
      trending = data.map((v: any) => ({
        videoId: v.url.split('?v=')[1],
        title: v.title,
        artist: v.uploaderName,
        album: `${v.viewCount?.toLocaleString() || 0} views`,
        duration: v.duration,
        thumbnail: v.thumbnail,
        uploaderUrl: v.uploaderUrl || '',
        uploaderAvatar: v.uploaderAvatar || ''
      }))
      if (trending.length > 0) break
    } catch (e) {
      continue
    }
  }

  // 2. Try Invidious API Instances (Fallback)
  if (trending.length === 0) {
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const res = await fetch(`${instance}/api/v1/trending?region=US`, { next: { revalidate: 3600 } })
        if (!res.ok) continue
        const data = await res.json()
        trending = data.map((v: any) => ({
          videoId: v.videoId,
          title: v.title,
          artist: v.author,
          album: `${v.viewCount?.toLocaleString() || 0} views`,
          duration: v.lengthSeconds,
          thumbnail: v.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url || v.videoThumbnails?.[0]?.url || '',
          uploaderUrl: `/channel/${v.authorId}`,
          uploaderAvatar: ''
        }))
        if (trending.length > 0) break
      } catch (e) {
        continue
      }
    }
  }

  if (trending.length === 0) {
    return NextResponse.json({ error: 'Failed to fetch trending data' }, { status: 500 })
  }

  return NextResponse.json({ 
    creatorsPicks: trending.slice(0, 8), 
    artists: trending.slice(8, 16).map((v: any) => ({
       artistId: v.uploaderUrl?.split('/channel/')[1] || v.uploaderUrl?.split('/c/')[1] || '',
       name: v.artist,
       subscribers: 'Trending',
       thumbnail: v.uploaderAvatar || v.thumbnail
    })), 
    songs: trending.slice(16, 28), 
    albums:[] 
  })
}
