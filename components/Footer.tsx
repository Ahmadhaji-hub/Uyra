'use client'

import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="relative px-6 py-12">
      <div className="section-line absolute top-0 left-0 right-0" />
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="text-center sm:text-left">
          <p className="text-[#f8f8f8] font-semibold tracking-tight mb-1">Uyra</p>
          <p className="text-[#3a3a3a] text-xs tracking-wide">Building the first true Digital Self.</p>
        </div>

        <div className="flex items-center gap-8 text-xs text-[#3a3a3a]">
          <Link href="/privacy" className="hover:text-[#7a7a7a] transition-colors duration-200">Privacy</Link>
          <Link href="/terms" className="hover:text-[#7a7a7a] transition-colors duration-200">Terms</Link>
          <a href="mailto:hello@uyra.ai" className="hover:text-[#7a7a7a] transition-colors duration-200">Contact</a>
        </div>

        <p className="text-[#2a2a2a] text-xs">
          © {new Date().getFullYear()} Uyra
        </p>
      </div>
    </footer>
  )
}
