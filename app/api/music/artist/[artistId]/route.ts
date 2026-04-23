import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const PIPED_INSTANCES = [
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.syncpundit.io',
  'https://piped-api.garudalinux.org',
  'https://pipedapi.kavin.rocks',
  'https://api-piped.mha.fi'
]

const INVIDIOUS_INSTANCES = [
  'https://invidious.weblibre.org',
  'https://invidious.jing.rocks',
  'https://vid.puffyan.us',
  'https://invidious.nerdvpn.de'
]

export async function GET(
  request: NextRequest, 
  { params }: { params: Promise<{ artistId: string }> }
) {
  const { artistId } = await params
  if (!artistId) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // 1. Try Piped API Instances
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}/channel/${artistId}`, { 
        next: { revalidate: 3600 } 
      })
      if (!res.ok) continue
      
      const data = await res.json()
      const topSongs = (data.relatedStreams || []).map((v: any) => ({
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
      continue
    }
  }

  // 2. Try Invidious API Instances (Fallback)
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${instance}/api/v1/channels/${artistId}`, { 
        next: { revalidate: 3600 } 
      })
      if (!res.ok) continue
      
      const data = await res.json()
      const topSongs = (data.latestVideos || []).map((v: any) => ({
        videoId: v.videoId,
        title: v.title,
        artist: data.author,
        album: `${v.viewCount?.toLocaleString() || 0} views`,
        duration: v.lengthSeconds,
        thumbnail: v.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url || v.videoThumbnails?.[0]?.url || ''
      }))

      return NextResponse.json({ 
        name: data.author,
        description: data.description,
        subscribers: `${data.subCount?.toLocaleString() || 0} subscribers`,
        thumbnails: [{ url: data.authorThumbnails?.[data.authorThumbnails.length - 1]?.url || '' }],
        topSongs,
        albums: [],
        singles: []
      })
    } catch (e) {
      continue
    }
  }

  return NextResponse.json({ error: 'Failed to fetch creator data from all providers' }, { status: 500 })
}
