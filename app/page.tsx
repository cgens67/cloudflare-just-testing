"use client"

import { useEffect, useState } from "react"
import { AudioPlayer } from "@/components/audio-player"

export default function Page() {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  },[])

  if (!hasMounted) return <div className="h-screen w-screen bg-background" />

  return <AudioPlayer />
}
