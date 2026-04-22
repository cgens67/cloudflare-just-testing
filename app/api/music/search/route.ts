import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  try {
    const res = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=videos`)
    if (!res.ok) throw new Error()
    const data = await res.json()
    
    const videos = data.items.map((v: any) => ({
      videoId: v.url.split('?v=')[1],
      title: v.title,
      artist: v.uploaderName, 
      album: `${v.viewCount?.toLocaleString() || 0} views`, 
      duration: v.duration,
      thumbnail: v.thumbnail,
    }))

    return NextResponse.json({ results: videos })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
