import { NextRequest, NextResponse } from 'next/server'

// List of public Piped instances for audio streaming
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.syncpundit.io', 
  'https://api.piped.yt',
  'https://pipedapi.in.projectsegfau.lt',
]

async function tryGetAudioStream(videoId: string): Promise<{ audioUrl: string; duration: number } | null> {
  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await fetch(`${instance}/streams/${videoId}`, {
        headers: {
          'User-Agent': 'v0AudioPlayer/1.0',
        },
      })

      if (!response.ok) continue

      const data = await response.json()
      
      // Find the best audio stream
      const audioStreams = data.audioStreams || []
      
      // Sort by quality (bitrate), prefer higher quality
      const sortedStreams = audioStreams
        .filter((stream: { mimeType: string }) => stream.mimeType?.includes('audio'))
        .sort((a: { bitrate: number }, b: { bitrate: number }) => (b.bitrate || 0) - (a.bitrate || 0))

      if (sortedStreams.length > 0) {
        return {
          audioUrl: sortedStreams[0].url,
          duration: data.duration || 0,
        }
      }
    } catch (error) {
      console.error(`Piped instance ${instance} failed:`, error)
      continue
    }
  }

  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params

  try {
    const result = await tryGetAudioStream(videoId)

    if (!result) {
      return NextResponse.json(
        { error: 'Could not find audio stream' },
        { status: 404 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Stream error:', error)
    return NextResponse.json(
      { error: 'Failed to get audio stream' },
      { status: 500 }
    )
  }
}
