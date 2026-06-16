import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Uyra — Your Digital Self',
  description: 'The first Personal AI Operating System that learns who you are, how you think, and how you decide.',
  openGraph: {
    title: 'Uyra — Your Digital Self',
    description: 'Uyra learns you, represents you, and acts for you.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Uyra — Your Digital Self',
    description: 'Uyra learns you, represents you, and acts for you.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#050505] text-[#f8f8f8] antialiased" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
