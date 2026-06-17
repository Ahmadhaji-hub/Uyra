'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

const sections = [
  {
    index: '01',
    title: 'Mission',
    body: 'Build the first true Digital Self for every human.',
    large: true,
  },
  {
    index: '02',
    title: 'Vision',
    body: 'Every person will eventually have a Digital Self — as fundamental as a phone number, an email address, or a bank account.',
    large: false,
  },
  {
    index: '03',
    title: 'What We Are',
    body: 'A Personal AI Operating System that learns you, represents you, and acts for you.',
    large: false,
  },
  {
    index: '04',
    title: 'What Makes Us Different',
    lines: [
      { muted: true, text: "Today's AI knows the world." },
      { muted: false, text: 'Uyra knows you.' },
    ],
    large: false,
  },
  {
    index: '05',
    title: 'Trust First',
    body: 'Uyra never acts without earning trust. Every action is shown. Every decision is explained. You are always in control.',
    large: false,
  },
  {
    index: '06',
    title: 'Long-Term Goal',
    body: 'A trusted Digital Self for every human on earth.',
    large: true,
  },
]

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] },
})

export default function ManifestPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#f8f8f8]">

      {/* Top bar */}
      <header className="px-6 md:px-12 py-7 flex items-center justify-between border-b border-white/5">
        <Link href="/" className="text-[#f8f8f8] font-semibold tracking-tight hover:text-white/70 transition-colors duration-200">
          Uyra
        </Link>
        <span className="text-xs tracking-widest uppercase text-[#3a3a3a]">Manifest</span>
      </header>

      {/* Hero */}
      <div className="px-6 md:px-12 pt-24 pb-20 border-b border-white/5 max-w-7xl">
        <motion.p
          className="text-xs tracking-widest uppercase text-[#555] mb-6"
          {...fadeUp(0.1)}
        >
          Uyra Manifest
        </motion.p>
        <motion.h1
          className="text-[clamp(3rem,8vw,7rem)] font-semibold leading-[0.96] tracking-[-0.04em] text-[#f8f8f8] max-w-4xl"
          {...fadeUp(0.2)}
        >
          We believe every
          <br />
          person deserves
          <br />
          <span className="text-[#3a3a3a]">a Digital Self.</span>
        </motion.h1>
      </div>

      {/* Sections */}
      <div className="max-w-7xl">
        {sections.map((section, i) => (
          <motion.div
            key={section.index}
            className="grid md:grid-cols-[160px_1fr] gap-8 md:gap-16 px-6 md:px-12 py-16 border-b border-white/5 group hover:bg-white/[0.01] transition-colors duration-500"
            {...fadeUp(0.15 + i * 0.08)}
          >
            {/* Index */}
            <div className="flex md:flex-col gap-4 md:gap-0">
              <span className="text-xs tracking-widest uppercase text-[#2a2a2a] group-hover:text-[#3a3a3a] transition-colors duration-300 md:mt-2">
                {section.index}
              </span>
            </div>

            {/* Content */}
            <div>
              <p className="text-xs tracking-widest uppercase text-[#555] mb-5">
                {section.title}
              </p>

              {section.lines ? (
                <div className="space-y-1">
                  {section.lines.map((line) => (
                    <p
                      key={line.text}
                      className={`font-semibold leading-tight tracking-[-0.03em] ${
                        section.large
                          ? 'text-[clamp(1.8rem,4vw,3.5rem)]'
                          : 'text-[clamp(1.5rem,3vw,2.5rem)]'
                      } ${line.muted ? 'text-[#2a2a2a]' : 'text-[#f8f8f8]'}`}
                    >
                      {line.text}
                    </p>
                  ))}
                </div>
              ) : (
                <p
                  className={`font-semibold leading-tight tracking-[-0.03em] ${
                    section.large
                      ? 'text-[clamp(1.8rem,4vw,3.5rem)] text-[#f8f8f8]'
                      : 'text-[clamp(1.2rem,2.5vw,1.8rem)] text-[#c4c4c4] font-normal leading-relaxed'
                  }`}
                >
                  {section.body}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 md:px-12 py-12 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[#2a2a2a] text-xs tracking-wide">
          © {new Date().getFullYear()} Uyra — Building the first true Digital Self.
        </p>
        <Link
          href="/"
          className="text-xs text-[#3a3a3a] hover:text-[#7a7a7a] transition-colors duration-200 tracking-wide"
        >
          Back to home
        </Link>
      </div>

    </main>
  )
}
