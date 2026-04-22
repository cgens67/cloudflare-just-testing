import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET() {
  try {
    const res = await fetch('https://pipedapi.kavin.rocks/trending?region=US')
    if (!res.ok) throw new Error()
    const data = await res.json()
    
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
      albums: [] 
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
