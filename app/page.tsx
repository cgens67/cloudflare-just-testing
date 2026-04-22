"use client"

import { useEffect, useState } from "react"
import { AudioPlayer } from "@/components/audio-player"

export default function Page() {
  const[isMounted, setIsMounted] = useState(false)

  // This ensures the player ONLY renders in the browser, preventing Cloudflare SSR crashes.
  useEffect(() => {
    setIsMounted(true)
  },
