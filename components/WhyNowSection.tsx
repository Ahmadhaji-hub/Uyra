'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'

const todayItems = ['A phone', 'An email', 'A bank account']
const soonItems = ['A Digital Self']

export default function WhyNowSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <section ref={ref} className="relative py-40 px-6 overflow-hidden">
      <div className="section-line absolute top-0 left-0 right-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(100,80,200,0.04)_0%,transparent_70%)] pointer-events-none" />

      <div className="max-w-5xl mx-auto">

        {/* Label + headline */}
        <motion.p
          className="text-xs tracking-widest uppercase text-[#555] mb-6"
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          Why Now?
        </motion.p>

        <motion.h2
          className="text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[#f8f8f8] mb-8 max-w-3xl"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          The pieces have
          <br />
          <span className="text-[#3a3a3a]">finally arrived.</span>
        </motion.h2>

        <motion.p
          className="text-[#7a7a7a] text-lg leading-relaxed max-w-2xl mb-20"
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          For the first time, AI can understand language, remember context, and interact with digital tools.
          The technologies required to build a Digital Self now exist.
        </motion.p>

        {/* Visual list */}
        <div className="grid md:grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5 mb-16">

          {/* Today */}
          <motion.div
            className="bg-[#050505] p-10"
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-xs tracking-widest uppercase text-[#3a3a3a] mb-8">Every person already has</p>
            <div className="space-y-5">
              {todayItems.map((item, i) => (
                <motion.div
                  key={item}
                  className="flex items-center gap-4"
                  initial={{ opacity: 0, x: -12 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.09 }}
                >
                  <div className="w-px h-8 bg-[#2a2a2a] flex-shrink-0" />
                  <p className="text-[#a0a0a0] text-lg font-light">{item}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Soon */}
          <motion.div
            className="bg-[#0d0c14] p-10 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(120,100,220,0.07),transparent)] pointer-events-none" />
            <div className="relative">
              <p className="text-xs tracking-widest uppercase text-[#9b8fff] mb-8">Soon every person will have</p>
              <div className="space-y-5">
                {soonItems.map((item, i) => (
                  <motion.div
                    key={item}
                    className="flex items-center gap-4"
                    initial={{ opacity: 0, x: -12 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.5, delay: 0.55 + i * 0.09 }}
                  >
                    <div className="w-px h-8 bg-[#9b8fff]/30 flex-shrink-0" />
                    <p className="text-[#f8f8f8] text-2xl font-medium tracking-tight">{item}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

        </div>

        {/* Closing line */}
        <motion.p
          className="text-[clamp(1.4rem,3vw,2rem)] font-semibold tracking-[-0.02em] text-[#f8f8f8]"
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          Uyra is building that future.
        </motion.p>

      </div>
    </section>
  )
}
