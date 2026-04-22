import dynamic from "next/dynamic"

// This forces Next.js to skip Server-Side Rendering (SSR) for the player.
// It will only load in the client's browser, preventing Cloudflare backend crashes!
const AudioPlayer = dynamic(
  () => import("@/components/audio-player").then((mod) => mod.AudioPlayer),
  { ssr: false }
)

export default function Page() {
  return <AudioPlayer />
}
