import { NextRequest, NextResponse } from 'next/server'

interface LyricLine {
  time: number
  text: string
}

function parseSyncedLyrics(syncedLyrics: string): LyricLine[] {
  const lines: LyricLine[] = []
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)$/gm
  let match
  while ((match = regex.exec(syncedLyrics)) !== null) {
    const minutes = parseInt(match[1], 10)
    const seconds = parseInt(match[2], 10)
    const hundredths = parseInt(match[3], 10)
    const text = match[4].trim()
    if (text) {
      const time = minutes * 60 + seconds + hundredths / (match[3].length === 3 ? 1000 : 100)
      lines.push({ time, text })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}

async function fetchLrcLib(trackName: string, artistName: string, albumName: string | null, duration: string | null) {
  const params = new URLSearchParams({ track_name: trackName, artist_name: artistName })
  if (albumName) params.append('album_name', albumName)
  if (duration) params.append('duration', duration)

  let res = await fetch(`https://lrclib.net/api/get?${params}`, { headers: { 'User-Agent': 'GanvoMusic/1.0' }})
  if (!res.ok) {
    res = await fetch(`https://lrclib.net/api/search?track_name=${encodeURIComponent(trackName)}&artist_name=${encodeURIComponent(artistName)}`, { headers: { 'User-Agent': 'GanvoMusic/1.0' }})
    if (res.ok) {
      const searchResults = await res.json()
      if (searchResults.length > 0) return searchResults[0]
    }
    return null
  }
  return await res.json()
}

async function fetchKuGou(trackName: string, artistName: string) {
  try {
    const searchRes = await fetch(`http://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${encodeURIComponent(artistName + ' ' + trackName)}&page=1&pagesize=1`)
    const searchData = await searchRes.json()
    const song = searchData?.data?.info?.[0]
    if (!song || !song.hash) return null

    const lyricsRes = await fetch(`http://m.kugou.com/app/i/krc.php?cmd=100&hash=${song.hash}&timelength=${song.duration * 1000}`)
    const lyricsText = await lyricsRes.text()
    if (lyricsText && lyricsText.includes('[')) {
      return { syncedLyrics: lyricsText, plainLyrics: lyricsText.replace(/\[.*?\]/g, '') }
    }
    return null
  } catch (e) {
    return null
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const trackName = searchParams.get('track')
  const artistName = searchParams.get('artist')
  const albumName = searchParams.get('album')
  const duration = searchParams.get('duration')
  const provider = searchParams.get('provider') || 'lrclib'

  if (!trackName || !artistName) return NextResponse.json({ error: 'Track and artist are required' }, { status: 400 })

  let data = null

  if (provider === 'kugou') {
    data = await fetchKuGou(trackName, artistName)
    if (!data) data = await fetchLrcLib(trackName, artistName, albumName, duration)
  } else {
    data = await fetchLrcLib(trackName, artistName, albumName, duration)
    if (!data) data = await fetchKuGou(trackName, artistName)
  }

  if (!data || (!data.syncedLyrics && !data.plainLyrics)) {
    return NextResponse.json({ error: 'No lyrics found', lyrics: null, syncedLyrics: null })
  }

  return NextResponse.json({
    plainLyrics: data.plainLyrics || null,
    syncedLyrics: data.syncedLyrics ? parseSyncedLyrics(data.syncedLyrics) : null,
  })
}
