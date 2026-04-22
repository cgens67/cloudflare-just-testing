import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET() {
  return NextResponse.json({ 
    name: 'Playlist Unavailable',
    artist: '',
    year: '',
    thumbnails: [],
    songs:
