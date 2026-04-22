import { NextResponse } from 'next/server'

export const runtime = 'edge'

const PIPED_INSTANCES =[
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.syncpundit.io',
  'https://piped-api.garudalinux.org',
  'https://pipedapi.kavin.rocks',
  'https://api-piped.mha.fi'
]

async function fetchWithFallback(endpoint: string) {
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}${endpoint}`, {
        cf: { cacheEverything: true, cacheTtl: 3600 }
      })
      if (res.ok) return await res.json()
    } catch (e) {
      continue
    }
  }
  throw new Error('All instances failed')
}

export async function GET() {
  try {
    const data = await fetchWithFallback('/trending?region=US')
    
    const trending = data.map((v: any) => ({
      videoId: v.url.split('?v=')[1],
      title: v.title,
      artist: v.uploaderName,
      album: `${v.viewCount?.toLocaleString() || 0} views`,
      duration: v.duration,
      thumbnail: v.thumbnail
    }))

    return NextResponse.json({ 
      creatorsPicks: trending.slice(0, 8), 
      artists: trending.slice(8, 16).map((v: any) => ({
         artistId: v.uploaderUrl?.split('/channel/')[1] || v.uploaderUrl?.split('/c/')[1] || '',
         name: v.artist || v.uploaderName,
         subscribers: 'Trending',
         thumbnail: v.thumbnail
      })), 
      songs: trending.slice(16, 28), 
      albums:[] 
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
