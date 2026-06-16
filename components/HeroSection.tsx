'use client'

import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'

const ParticleOrb = dynamic(() => import('./ParticleOrb'), { ssr: false })

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(120,100,200,0.06)_0%,transparent_70%)]" />

      {/* Particle orb */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-full h-full max-w-4xl mx-auto opacity-90">
          <ParticleOrb />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        {/* Label */}
        <motion.div
          className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-white/8 bg-white/3 text-xs text-[#7a7a7a] tracking-widest uppercase"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#9b8fff] animate-pulse" />
          Personal AI Operating System
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-[clamp(3.5rem,10vw,8.5rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-[#f8f8f8] mb-8 text-glow"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          Your Digital
          <br />
          <span className="gradient-text">Self.</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          className="text-[clamp(1rem,2.5vw,1.25rem)] text-[#7a7a7a] max-w-2xl mx-auto leading-relaxed mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          The first Personal AI Operating System that learns who you are,
          how you think, and how you decide.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          <a
            href="#waitlist"
            className="group relative px-8 py-3.5 rounded-full bg-[#f8f8f8] text-[#050505] text-sm font-medium tracking-tight overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(248,248,248,0.15)]"
          >
            <span className="relative z-10">Join the Waitlist</span>
          </a>

          <a
            href="#vision"
            className="px-8 py-3.5 rounded-full border border-white/10 text-[#a0a0a0] text-sm font-medium tracking-tight hover:text-[#f8f8f8] hover:border-white/20 transition-all duration-300"
          >
            Watch the Vision
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
      >
        <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
      </motion.div>
    </section>
  )
}
