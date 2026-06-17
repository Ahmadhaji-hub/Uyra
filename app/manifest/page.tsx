'use client'

import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import { useRef } from 'react'

function Section({
  index,
  title,
  children,
  delay = 0,
}: {
  index: string
  title: string
  children: React.ReactNode
  delay?: number
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-12%' })

  return (
    <motion.div
      ref={ref}
      className="grid md:grid-cols-[160px_1fr] gap-8 md:gap-16 px-6 md:px-12 py-16 border-b border-white/5 group hover:bg-white/[0.01] transition-colors duration-500"
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex md:flex-col gap-3 md:gap-0 items-start">
        <span className="text-xs tracking-widest uppercase text-[#2a2a2a] group-hover:text-[#3a3a3a] transition-colors duration-300 md:mt-1.5 flex-shrink-0">
          {index}
        </span>
      </div>
      <div>
        <p className="text-xs tracking-widest uppercase text-[#555] mb-8">{title}</p>
        {children}
      </div>
    </motion.div>
  )
}

// A line of prose
function Line({
  children,
  size = 'body',
  muted = false,
  accent = false,
}: {
  children: React.ReactNode
  size?: 'hero' | 'large' | 'body' | 'small'
  muted?: boolean
  accent?: boolean
}) {
  const sizes = {
    hero:  'text-[clamp(2rem,5vw,4.5rem)] font-semibold tracking-[-0.04em] leading-[1.0]',
    large: 'text-[clamp(1.6rem,3.5vw,3rem)] font-semibold tracking-[-0.03em] leading-[1.1]',
    body:  'text-[clamp(1rem,2vw,1.35rem)] font-normal leading-relaxed tracking-[-0.01em]',
    small: 'text-sm font-normal leading-relaxed tracking-wide',
  }
  const color = accent
    ? 'text-[#f8f8f8]'
    : muted
    ? 'text-[#3a3a3a]'
    : size === 'hero' || size === 'large'
    ? 'text-[#f8f8f8]'
    : 'text-[#7a7a7a]'

  return <p className={`${sizes[size]} ${color} mb-3 last:mb-0`}>{children}</p>
}

// Highlighted pull-quote
function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 pl-5 border-l border-[#9b8fff]/40">
      <p className="text-[clamp(1.2rem,2.5vw,1.9rem)] font-semibold tracking-[-0.02em] leading-snug text-[#f8f8f8]">
        {children}
      </p>
    </div>
  )
}

// Vertical list with a leading rule
function ManifestList({
  items,
  accent = false,
}: {
  items: string[]
  accent?: boolean
}) {
  return (
    <div className="space-y-3 mt-1">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-4">
          <div className={`w-px h-7 flex-shrink-0 mt-1 ${accent ? 'bg-[#9b8fff]/40' : 'bg-[#2a2a2a]'}`} />
          <p className={`text-lg font-light ${accent ? 'text-[#f8f8f8]' : 'text-[#7a7a7a]'}`}>{item}</p>
        </div>
      ))}
    </div>
  )
}

export default function ManifestPage() {
  const heroRef = useRef(null)
  const heroInView = useInView(heroRef, { once: true })

  return (
    <main className="min-h-screen bg-[#050505] text-[#f8f8f8]">

      {/* Top bar */}
      <header className="px-6 md:px-12 py-7 flex items-center justify-between border-b border-white/5">
        <Link
          href="/"
          className="text-[#f8f8f8] font-semibold tracking-tight hover:text-white/60 transition-colors duration-200"
        >
          Uyra
        </Link>
        <span className="text-xs tracking-widest uppercase text-[#3a3a3a]">Manifest</span>
      </header>

      {/* Hero */}
      <div ref={heroRef} className="px-6 md:px-12 pt-28 pb-24 border-b border-white/5">
        <motion.p
          className="text-xs tracking-widest uppercase text-[#555] mb-8"
          initial={{ opacity: 0 }}
          animate={heroInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          Uyra Manifest
        </motion.p>
        <motion.h1
          className="text-[clamp(3rem,9vw,8rem)] font-semibold leading-[0.94] tracking-[-0.04em] text-[#f8f8f8] max-w-5xl mb-8"
          initial={{ opacity: 0, y: 28 }}
          animate={heroInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          Every person
          <br />
          will have a
          <br />
          <span className="text-[#3a3a3a]">Digital Self.</span>
        </motion.h1>
        <motion.p
          className="text-[#555] text-xl max-w-xl leading-relaxed"
          initial={{ opacity: 0, y: 16 }}
          animate={heroInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          A trusted digital extension of themselves.
        </motion.p>
      </div>

      {/* Sections */}
      <div className="max-w-7xl">

        {/* 01 Mission */}
        <Section index="01" title="Mission">
          <Line size="large">Build the first true Digital Self for every human.</Line>
          <div className="mt-6 space-y-2">
            <Line muted>Not another chatbot.</Line>
            <Line muted>Not another productivity tool.</Line>
          </div>
          <div className="mt-5">
            <Line size="body" accent>
              A digital self that learns, remembers, represents, and acts.
            </Line>
          </div>
        </Section>

        {/* 02 Vision */}
        <Section index="02" title="Vision">
          <Line size="body" muted>Every person already has:</Line>
          <ManifestList items={['A phone.', 'An email.', 'A bank account.']} />
          <div className="mt-8">
            <Line size="body" muted>Soon every person will have:</Line>
            <ManifestList items={['A Digital Self.']} accent />
          </div>
          <div className="mt-8">
            <Line size="body">
              We believe this will become a fundamental layer of human life.
            </Line>
          </div>
        </Section>

        {/* 03 What We Are */}
        <Section index="03" title="What We Are">
          <Line size="large">Uyra is a Personal AI Operating System.</Line>
          <div className="mt-6 space-y-2">
            <Line>It learns who you are.</Line>
            <Line>It understands how you think.</Line>
            <Line>It remembers what matters.</Line>
          </div>
          <div className="mt-6">
            <Line>
              And over time, it becomes capable of acting on your behalf.
            </Line>
          </div>
        </Section>

        {/* 04 What Makes Us Different */}
        <Section index="04" title="What Makes Us Different">
          <PullQuote>
            Today's AI knows the world.
            <br />
            <span className="text-[#9b8fff]">Uyra knows you.</span>
          </PullQuote>
          <div className="mt-6 space-y-4">
            <div>
              <Line muted>Most AI systems answer questions.</Line>
              <Line accent>Uyra builds understanding.</Line>
            </div>
            <div>
              <Line muted>Most AI systems generate information.</Line>
              <Line accent>Uyra builds identity.</Line>
            </div>
          </div>
        </Section>

        {/* 05 Trust First */}
        <Section index="05" title="Trust First">
          <div className="space-y-2">
            <Line muted>Trust is not assumed.</Line>
            <Line size="large">Trust is earned.</Line>
          </div>
          <div className="mt-8 space-y-2">
            <Line>Uyra never acts without permission.</Line>
            <Line>Every action is visible.</Line>
            <Line>Every decision is explainable.</Line>
          </div>
          <div className="mt-6">
            <Line size="large">You remain in control.</Line>
            <Line muted>Always.</Line>
          </div>
        </Section>

        {/* 06 The Digital Self */}
        <Section index="06" title="The Digital Self">
          <div className="space-y-1">
            <Line muted>A Digital Self is more than memory.</Line>
            <Line muted>More than automation.</Line>
            <Line muted>More than an assistant.</Line>
          </div>
          <div className="mt-8 space-y-2">
            <Line>It understands your priorities.</Line>
            <Line>Your relationships.</Line>
            <Line>Your goals.</Line>
            <Line>Your decisions.</Line>
          </div>
          <div className="mt-8">
            <Line size="large">
              And gradually becomes a trusted extension of you.
            </Line>
          </div>
        </Section>

        {/* 07 The Future */}
        <Section index="07" title="The Future">
          <div className="grid sm:grid-cols-2 gap-8 mb-10">
            <div>
              <p className="text-xs tracking-widest uppercase text-[#3a3a3a] mb-5">Today</p>
              <ManifestList items={['A phone', 'An email', 'A bank account']} />
            </div>
            <div>
              <p className="text-xs tracking-widest uppercase text-[#9b8fff] mb-5">Tomorrow</p>
              <ManifestList items={['A Digital Self']} accent />
            </div>
          </div>

          <div className="space-y-2 mt-2">
            <Line muted>The next interface is not an app.</Line>
          </div>

          <PullQuote>
            The next interface is{' '}
            <span className="text-[#9b8fff]">you.</span>
          </PullQuote>

          <div className="mt-4">
            <Line size="large">Uyra is building that future.</Line>
          </div>
        </Section>

      </div>

      {/* Footer */}
      <div className="px-6 md:px-12 py-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5">
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
