'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] },
  }),
}

export default function ProblemSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-15%' })

  return (
    <section ref={ref} className="relative py-40 px-6 overflow-hidden">
      <div className="section-line mb-0 absolute top-0 left-0 right-0" />

      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(255,255,255,0.015)_0%,transparent_70%)] pointer-events-none" />

      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-center">
          {/* Left */}
          <div>
            <motion.p
              className="text-xs tracking-widest uppercase text-[#555] mb-6"
              custom={0}
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
              variants={fadeUp}
            >
              The Problem
            </motion.p>
            <motion.h2
              className="text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[#f8f8f8]"
              custom={1}
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
              variants={fadeUp}
            >
              Today's AI knows
              <br />
              the world.
            </motion.h2>
            <motion.h2
              className="text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[#3a3a3a] mt-2"
              custom={2}
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
              variants={fadeUp}
            >
              But it doesn't
              <br />
              know you.
            </motion.h2>
          </div>

          {/* Right */}
          <div className="space-y-6">
            {[
              {
                label: 'No memory',
                text: 'Every conversation starts from zero. It never remembers what you told it last week.',
              },
              {
                label: 'No identity',
                text: 'It doesn\'t know your values, your voice, your relationships, or what drives your decisions.',
              },
              {
                label: 'No continuity',
                text: 'It can\'t act as you, represent you, or make decisions the way you would.',
              },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                className="p-6 rounded-2xl border border-white/5 bg-white/2 hover:bg-white/3 transition-colors duration-300"
                custom={i + 2}
                initial="hidden"
                animate={inView ? 'visible' : 'hidden'}
                variants={fadeUp}
              >
                <p className="text-xs tracking-widest uppercase text-[#555] mb-2">{item.label}</p>
                <p className="text-[#a0a0a0] leading-relaxed text-sm">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
