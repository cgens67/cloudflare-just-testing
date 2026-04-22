import { NextRequest, NextResponse } from 'next/server'

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ artistId: string }> }) {
  const { artistId } = await params
  if (!artistId) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  try {
    const data = await fetchWithFallback(`/channel/${artistId}`)

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
      singles:
