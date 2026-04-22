import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest, { params }: { params: Promise<{ artistId: string }> }) {
  const { artistId } = await params
  try {
    const res = await fetch(`https://pipedapi.kavin.rocks/channel/${artistId}`)
    if (!res.ok) throw new Error()
    const data = await res.json()

    const topSongs = data.relatedStreams.map((v: any) => ({
      videoId: v.url.split('?v=')[1],
      title: v.title,
      artist: data.name,
      album: `${v.viewCount?.toLocaleString() || 0} views`,
      duration: v.duration,
      thumbnail: v.thumbnail
    }))

    return NextResponse.json({ 
      name: data.name,
      description: data.description,
      subscribers: `${data.subscriberCount?.toLocaleString() || 0} subscribers`,
      thumbnails: [{ url: data.avatarUrl }],
      topSongs,
      albums: [],
      singles: []
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
