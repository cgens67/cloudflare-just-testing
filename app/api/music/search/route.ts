import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=videos`, {
      cf: { cacheEverything: true, cacheTtl: 3600 }
    })
    
    if (!res.ok) throw new Error('API Error')
    
    const data = await res.json()
    
    const videos = data.items.slice(0, 20).map((video: any) => ({
      videoId: video.url.split('?v=')[1],
      title: video.title,
      artist: video.uploaderName, 
      album: video.views.toLocaleString() + ' views', 
      duration: video.duration,
      thumbnail: video.thumbnail,
    }))

    return NextResponse.json({ results: videos })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to search videos' }, { status: 500 })
  }
}
