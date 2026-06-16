'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const today = [
  { label: 'A phone', sub: 'Your voice to the world.' },
  { label: 'An email', sub: 'Your address on the internet.' },
  { label: 'A bank account', sub: 'Your financial identity.' },
]

const tomorrow = [
  { label: 'A Digital Self', sub: 'Your trusted agent in a world run by AI.' },
]

export default function FutureSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <section id="future" ref={ref} className="relative py-40 px-6 overflow-hidden">
      <div className="section-line absolute top-0 left-0 right-0" />

      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_60%,rgba(100,80,200,0.04)_0%,transparent_70%)] pointer-events-none" />

      <div className="max-w-5xl mx-auto">
        <motion.p
          className="text-xs tracking-widest uppercase text-[#555] mb-6"
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          The Future
        </motion.p>

        <motion.h2
          className="text-[clamp(2.2rem,5vw,4.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[#f8f8f8] mb-20 max-w-3xl"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          Every person already has infrastructure.
          <br />
          <span className="text-[#3a3a3a]">One layer is missing.</span>
        </motion.h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Today */}
          <motion.div
            className="rounded-2xl border border-white/5 bg-[#0a0a0a] p-8"
            initial={{ opacity: 0, y: 28 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-xs tracking-widest uppercase text-[#3a3a3a] mb-8">Today</p>
            <div className="space-y-6">
              {today.map((item, i) => (
                <motion.div
                  key={item.label}
                  className="flex items-start gap-4"
                  initial={{ opacity: 0, x: -12 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.08 }}
                >
                  <div className="w-px h-10 bg-[#2a2a2a] flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-[#a0a0a0] font-medium mb-0.5">{item.label}</p>
                    <p className="text-[#3a3a3a] text-sm">{item.sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Soon */}
          <motion.div
            className="rounded-2xl border border-white/8 bg-[#0d0c14] p-8 relative overflow-hidden"
            initial={{ opacity: 0, y: 28 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(120,100,220,0.08),transparent)]" />

            <div className="relative">
              <p className="text-xs tracking-widest uppercase text-[#9b8fff] mb-8">Soon</p>
              <div className="space-y-6">
                {tomorrow.map((item) => (
                  <div key={item.label} className="flex items-start gap-4">
                    <div className="w-px h-10 bg-[#9b8fff]/30 flex-shrink-0 mt-1" />
                    <div>
                      <p className="text-[#f8f8f8] font-medium text-xl mb-1">{item.label}</p>
                      <p className="text-[#7a7a7a] text-sm">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-16 pt-8 border-t border-white/5">
                <p className="text-[#f8f8f8] text-3xl font-semibold tracking-[-0.03em] leading-tight">
                  Uyra is building
                  <br />
                  <span className="text-[#9b8fff]">the first true Digital Self.</span>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
