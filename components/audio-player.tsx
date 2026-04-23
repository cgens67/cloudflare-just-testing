import type { Metadata } from 'next'
import { Roboto } from 'next/font/google'
import './globals.css'

const roboto = Roboto({ 
  subsets: ["latin"],
  weight:["300", "400", "500", "700", "900"],
  variable: "--font-roboto"
});

export const metadata: Metadata = {
  title: 'VideoTube',
  description: 'Fast, secure video player',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${roboto.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
