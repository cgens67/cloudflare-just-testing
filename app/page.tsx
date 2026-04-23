"use client"

import { useEffect, useState } from "react"
import { AudioPlayer } from "@/components/audio-player"

export default function Page() {
  const [hasMounted, setHasMounted] = useState(false)

  // This hook only runs in the browser. 
  // It prevents the Player from ever trying to render on Cloudflare's server.
  useEffect(() => {
    setHasMounted(true)
  }, [])

  if (!hasMounted) {
    // Show a black screen while the browser loads
    return <div className="h-screen w-screen bg-black" />
  }

  return <AudioPlayer />
}
