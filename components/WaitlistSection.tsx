'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'

export default function WaitlistSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <section id="waitlist" ref={ref} className="relative py-40 px-6 overflow-hidden">
      <div className="section-line absolute top-0 left-0 right-0" />

      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_50%,rgba(100,80,200,0.06)_0%,transparent_70%)]" />

      <div className="max-w-3xl mx-auto text-center">
        <motion.p
          className="text-xs tracking-widest uppercase text-[#555] mb-8"
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          Early Access
        </motion.p>

        <motion.h2
          className="text-[clamp(2.5rem,7vw,5.5rem)] font-semibold leading-[1.0] tracking-[-0.04em] text-[#f8f8f8] mb-6"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          Be the first to
          <br />
          meet your
          <br />
          <span className="gradient-text">Digital Self.</span>
        </motion.h2>

        <motion.p
          className="text-[#7a7a7a] text-lg leading-relaxed mb-12 max-w-xl mx-auto"
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.25 }}
        >
          We're building with a small group of early users who want to shape
          the future of personal AI. Spots are limited.
        </motion.p>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 px-5 py-3.5 rounded-full bg-white/4 border border-white/8 text-[#f8f8f8] placeholder-[#3a3a3a] text-sm outline-none focus:border-white/20 focus:bg-white/6 transition-all duration-200"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-7 py-3.5 rounded-full bg-[#f8f8f8] text-[#050505] text-sm font-medium tracking-tight hover:bg-white transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(248,248,248,0.12)] disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loading ? 'Joining...' : 'Join Waitlist'}
              </button>
            </form>
          ) : (
            <motion.div
              className="flex flex-col items-center gap-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-12 h-12 rounded-full border border-white/10 bg-white/4 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10L8.5 14.5L16 6" stroke="#9b8fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-[#f8f8f8] text-lg font-medium">You're on the list.</p>
              <p className="text-[#555] text-sm">We'll reach out when your Digital Self is ready.</p>
            </motion.div>
          )}

          <p className="text-[#3a3a3a] text-xs mt-5 tracking-wide">
            No spam. No noise. Just Uyra.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
