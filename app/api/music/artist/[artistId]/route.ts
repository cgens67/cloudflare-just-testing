import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artistId: string }> }
) {
  const { artistId } = await params
  if (!artistId) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  try {
    const res = await fetch(`https://pipedapi.kavin.rocks/channel/${artistId}`, {
      cf: { cacheEverything: true, cacheTtl: 3600 }
    })
    if (!res.ok) throw new Error('API Error')
    const data = await res.json()

    const topSongs = (data.relatedStreams ||[]).slice(0, 15).map((v: any) => ({
      videoId: v.url.split('?v=')[1],
      title: v.title,
      artist: data.name,
      album: v.views.toLocaleString() + ' views',
      duration: v.duration,
      thumbnail: v.thumbnail
    }))

    return NextResponse.json({ 
      name: data.name,
      description: data.description,
      subscribers: data.subscriberCount.toLocaleString() + ' subscribers',
      thumbnails:[{ url: data.avatarUrl }],
      topSongs,
      albums: [],
      singles:[]
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch channel' }, { status: 500 })
  }
}
