'use client'

import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'

const demoSteps = [
  { type: 'user', text: 'Handle my inbox.' },
  { type: 'uyra-label', text: 'Understanding context...' },
  {
    type: 'uyra-action',
    label: 'Priority scan',
    text: 'Found 3 emails requiring your attention. Filtered 24 newsletters and low-priority threads.',
  },
  {
    type: 'uyra-action',
    label: 'Draft responses',
    text: 'Composed replies in your voice for the investor follow-up and the client proposal. Ready for your review.',
  },
  {
    type: 'uyra-action',
    label: 'Task extraction',
    text: 'Identified 2 action items: sign the contract by Friday, schedule the Q3 review.',
  },
  {
    type: 'uyra-action',
    label: 'Awaiting approval',
    text: 'Nothing has been sent. Showing you everything before it goes out.',
  },
]

export default function DemoSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })
  const [visibleSteps, setVisibleSteps] = useState(0)

  useEffect(() => {
    if (!inView) return
    const delays = [600, 1400, 2200, 3000, 3800, 4600]
    const timers = delays.map((delay, i) =>
      setTimeout(() => setVisibleSteps(i + 1), delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [inView])

  return (
    <section ref={ref} className="relative py-40 px-6 overflow-hidden">
      <div className="section-line absolute top-0 left-0 right-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(80,60,180,0.03)_0%,transparent_70%)]" />

      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-start">
          {/* Left: Text */}
          <div className="md:sticky md:top-32">
            <motion.p
              className="text-xs tracking-widest uppercase text-[#555] mb-6"
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7 }}
            >
              Digital Self — Demo
            </motion.p>
            <motion.h2
              className="text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[#f8f8f8] mb-6"
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              One prompt.
              <br />
              <span className="text-[#3a3a3a]">Your whole inbox.</span>
            </motion.h2>
            <motion.p
              className="text-[#7a7a7a] text-lg leading-relaxed"
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              Uyra doesn't just execute commands. It understands your intent,
              acts with judgment, and always keeps you in control.
            </motion.p>
          </div>

          {/* Right: Demo terminal */}
          <motion.div
            className="rounded-2xl border border-white/8 bg-[#0a0a0a] overflow-hidden"
            initial={{ opacity: 0, y: 32 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#2a2a2a]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#2a2a2a]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#2a2a2a]" />
              <span className="ml-3 text-xs text-[#3a3a3a] tracking-wide">Uyra — Digital Self</span>
            </div>

            {/* Messages */}
            <div className="p-6 space-y-5 min-h-[400px]">
              <AnimatePresence>
                {demoSteps.slice(0, visibleSteps).map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {step.type === 'user' && (
                      <div className="flex justify-end">
                        <div className="bg-white/6 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                          <p className="text-[#e8e8e8] text-sm">{step.text}</p>
                        </div>
                      </div>
                    )}

                    {step.type === 'uyra-label' && (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#1a1a1a] border border-white/8 flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 rounded-full bg-[#9b8fff]" />
                        </div>
                        <p className="text-[#555] text-xs tracking-wide">{step.text}</p>
                      </div>
                    )}

                    {step.type === 'uyra-action' && (
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#1a1a1a] border border-white/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <div className="w-2 h-2 rounded-full bg-[#9b8fff]" />
                        </div>
                        <div className="flex-1 bg-[#0f0f0f] rounded-xl rounded-tl-sm p-4 border border-white/4">
                          <p className="text-xs tracking-widest uppercase text-[#555] mb-2">
                            {step.label}
                          </p>
                          <p className="text-[#c4c4c4] text-sm leading-relaxed">{step.text}</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Cursor */}
              {visibleSteps > 0 && visibleSteps < demoSteps.length && (
                <motion.div
                  className="flex items-center gap-2 pl-9"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  <div className="w-1.5 h-4 rounded-sm bg-[#9b8fff] opacity-60" />
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
