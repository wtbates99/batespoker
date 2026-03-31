import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '♠ BATESPOKER — The Vault',
  description: 'Texas Hold\'em poker in The Vault. Play solo against AI opponents or host a table with friends. Self-hosted, open source.',
  keywords: ['poker', 'texas holdem', 'multiplayer poker', 'ai poker', 'online poker'],
  openGraph: {
    title: '♠ BATESPOKER — The Vault',
    description: 'Underground poker club. Solo vs AI or multiplayer rooms. Free forever.',
    type: 'website',
    url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://poker.palanbates.com',
  },
  twitter: {
    card: 'summary',
    title: '♠ BATESPOKER — The Vault',
    description: 'Underground poker club. Solo vs AI or multiplayer rooms.',
  },
}

export const viewport = {
  themeColor: '#030503',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script async src="https://analytics.palanbates.com/script.js" data-website-id="96ec04fd-c0ee-407c-b9f8-6533113ebfab"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&display=swap" rel="stylesheet" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%23030503'/><text x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='%23c9a84c'>♠</text></svg>"
        />
      </head>
      <body>
        <div className="scanlines" />
        <div className="noise" />
        {children}
      </body>
    </html>
  )
}
