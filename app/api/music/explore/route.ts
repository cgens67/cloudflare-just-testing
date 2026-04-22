import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const revalidate = 3600

export async function GET() {
  try {
    const res = await fetch('https://pipedapi.kavin.rocks/trending?region=US', {
      cf: { cacheEverything: true, cacheTtl: 3600 } 
    })
    
    if (!res.ok) throw new Error('API Error')
    
    const data = await res.json()
    
    const trendingVideos = data.slice(0, 30).map((video: any) => ({
      videoId: video.url.split('?v=')[1],
      title: video.title,
      artist: video.uploaderName,
      album: video.views.toLocaleString() + ' views',
      duration: video.duration,
      thumbnail: video.thumbnail
    }))

    return NextResponse.json({ 
      creatorsPicks: trendingVideos.slice(0, 8), 
      artists: trendingVideos.slice(8, 16).map((v: any) => ({
         artistId: v.uploaderUrl?.split('/channel/')[1] || '',
         name: v.artist,
         subscribers: 'Trending',
         thumbnail: v.uploaderAvatar || v.thumbnail
      })), 
      songs: trendingVideos.slice(16, 25), 
      albums:[] 
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch explore data' }, { status: 500 })
  }
}
