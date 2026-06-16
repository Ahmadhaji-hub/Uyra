'use client'

import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

const steps = [
  {
    number: '01',
    title: 'Learns you.',
    description:
      'Uyra connects to your digital life — emails, documents, conversations, calendars. It builds a model of your personality, values, communication style, and the way you make decisions. Not once. Continuously.',
    detail: 'Private. On-device. Yours.',
  },
  {
    number: '02',
    title: 'Represents you.',
    description:
      'Your Digital Self emerges. A trusted, accurate representation that understands your context, knows your relationships, and speaks in your voice. As nuanced as you are.',
    detail: 'Authentic. Contextual. Aligned.',
  },
  {
    number: '03',
    title: 'Acts for you.',
    description:
      'Uyra drafts responses, prioritizes decisions, manages tasks, and handles communication — the way you would. It always shows you what it\'s doing and waits for your approval on anything consequential.',
    detail: 'Trusted. Transparent. In control.',
  },
]

export default function HowItWorks() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <section id="how-it-works" ref={ref} className="relative py-40 px-6 overflow-hidden">
      <div className="section-line absolute top-0 left-0 right-0" />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="max-w-2xl mb-24">
          <motion.p
            className="text-xs tracking-widest uppercase text-[#555] mb-6"
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
          >
            How Uyra Works
          </motion.p>
          <motion.h2
            className="text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[#f8f8f8]"
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            Three steps.
            <br />
            <span className="text-[#3a3a3a]">One digital self.</span>
          </motion.h2>
        </div>

        {/* Steps */}
        <div className="space-y-0">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              className="group grid md:grid-cols-[200px_1fr] gap-8 md:gap-16 py-14 border-t border-white/5 hover:border-white/8 transition-colors duration-500"
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.2 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Number */}
              <div className="flex items-start gap-6 md:flex-col md:gap-0">
                <span className="text-5xl md:text-7xl font-semibold tracking-[-0.04em] text-[#1a1a1a] group-hover:text-[#2a2a2a] transition-colors duration-500 leading-none">
                  {step.number}
                </span>
              </div>

              {/* Content */}
              <div>
                <h3 className="text-[clamp(1.8rem,4vw,3rem)] font-semibold tracking-[-0.03em] text-[#f8f8f8] mb-5 leading-tight">
                  {step.title}
                </h3>
                <p className="text-[#7a7a7a] text-lg leading-relaxed max-w-2xl mb-5">
                  {step.description}
                </p>
                <span className="inline-flex items-center gap-2 text-xs tracking-widest uppercase text-[#4a4a4a]">
                  <span className="w-4 h-px bg-[#3a3a3a]" />
                  {step.detail}
                </span>
              </div>
            </motion.div>
          ))}
          <div className="border-t border-white/5" />
        </div>
      </div>
    </section>
  )
}
