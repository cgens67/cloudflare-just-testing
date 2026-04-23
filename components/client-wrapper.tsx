"use client"

import dynamic from "next/dynamic"

// This strictly forces the AudioPlayer to ONLY load in the browser.
// Cloudflare's server will completely ignore the Firebase/YouTube code!
const AudioPlayer = dynamic(
  () => import("@/components/audio-player").then((mod) => mod.AudioPlayer),
  { ssr: false }
)

export function ClientWrapper() {
  return <AudioPlayer />
}
