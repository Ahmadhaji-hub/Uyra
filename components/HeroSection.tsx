'use client'

import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'

const ParticleOrb = dynamic(() => import('./ParticleOrb'), { ssr: false })

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">

      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(120,100,200,0.06)_0%,transparent_70%)] pointer-events-none" />

      {/* Particle orb */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-full h-full max-w-4xl mx-auto opacity-90">
          <ParticleOrb />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">

        {/* Label */}
        <motion.div
          className="inline-flex items-center gap-2 mb-10 px-4 py-1.5 rounded-full border border-white/8 bg-white/[0.03] text-xs text-[#555] tracking-widest uppercase"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#9b8fff] animate-pulse" />
          Personal AI Operating System
        </motion.div>

        {/* Headline — most important */}
        <motion.h1
          className="text-[clamp(3.06rem,8.91vw,7.29rem)] font-semibold leading-[0.93] tracking-[-0.045em] text-[#f8f8f8] mb-7 text-glow"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.95, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          Your Digital
          <br />
          <span className="gradient-text">Self</span>
        </motion.h1>

        {/* Subheadline — second priority */}
        <motion.p
          className="text-[clamp(1.05rem,2.2vw,1.3rem)] text-[#6a6a6a] max-w-xl mx-auto leading-relaxed tracking-[-0.01em] mb-12"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          Uyra learns you, represents you,
          <br className="hidden sm:block" />
          and acts for you
        </motion.p>

        {/* CTAs — third priority */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          <a
            href="#waitlist"
            className="px-8 py-3.5 rounded-full bg-[#f8f8f8] text-[#050505] text-sm font-medium tracking-tight transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(248,248,248,0.14)]"
          >
            Join the Waitlist
          </a>
          <a
            href="/manifest"
            className="px-8 py-3.5 rounded-full border border-white/8 text-[#6a6a6a] text-sm font-medium tracking-tight hover:text-[#f8f8f8] hover:border-white/16 transition-all duration-300"
          >
            Read the Manifest
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
      >
        <div className="w-px h-14 bg-gradient-to-b from-transparent via-white/15 to-transparent" />
      </motion.div>

    </section>
  )
}
