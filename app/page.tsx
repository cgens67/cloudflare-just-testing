"use client"

import { useEffect, useState } from "react"
import { AudioPlayer } from "@/components/audio-player"

export default function Page() {
  const [mounted, setMounted] = useState(false)

  // This ensures the player ONLY renders in the browser.
  // It completely bypasses Cloudflare's backend server execution!
  useEffect(() => {
    setMounted(true)
  },[])

  if (!mounted) {
    return <div className="h-[100dvh] w-screen bg-background" />
  }

  return <AudioPlayer />
}
