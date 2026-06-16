'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const layers = [
  { label: 'Memory', desc: 'Every conversation, decision, and lesson remembered.' },
  { label: 'Personality', desc: 'Your tone, your voice, how you communicate.' },
  { label: 'Relationships', desc: 'The people who matter and your history with them.' },
  { label: 'Goals', desc: 'Short-term tasks. Long-term ambitions. Your north star.' },
  { label: 'Habits', desc: 'Your patterns, rituals, and ways of working.' },
  { label: 'Decisions', desc: 'How you weigh options. What you value. What you avoid.' },
]

export default function IdentityLayer() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <section ref={ref} className="relative py-40 px-6 overflow-hidden">
      <div className="section-line absolute top-0 left-0 right-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_30%,rgba(100,80,200,0.04)_0%,transparent_70%)]" />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="max-w-2xl mb-20">
          <motion.p
            className="text-xs tracking-widest uppercase text-[#555] mb-6"
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
          >
            The Missing Layer
          </motion.p>
          <motion.h2
            className="text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[#f8f8f8] mb-6"
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            The Identity Layer
          </motion.h2>
          <motion.p
            className="text-[#7a7a7a] text-lg leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Your emails. Your projects. Your memories. Your relationships. Your decisions.
            Connected into one living model of who you are.
          </motion.p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
          {layers.map((layer, i) => (
            <motion.div
              key={layer.label}
              className="group p-8 bg-[#050505] hover:bg-[#0c0c0c] transition-colors duration-300 relative overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Hover glow */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(150,130,255,0.06),transparent)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative">
                <div className="w-1.5 h-1.5 rounded-full bg-[#9b8fff] mb-5 opacity-60" />
                <h3 className="text-[#f8f8f8] font-medium text-lg mb-2 tracking-tight">{layer.label}</h3>
                <p className="text-[#555] text-sm leading-relaxed">{layer.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom label */}
        <motion.p
          className="text-center text-[#3a3a3a] text-sm mt-8 tracking-wide"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          All of it. Connected. Evolving. Yours.
        </motion.p>
      </div>
    </section>
  )
}
