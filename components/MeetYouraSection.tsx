'use client'

import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useRef, useState } from 'react'

const examples = [
  {
    id: 1,
    userMessage: 'Handle my inbox.',
    responses: [
      { label: 'Overview', text: '12 emails need replies.' },
      { label: 'Urgent', text: '3 require your attention today.' },
      { label: 'Low priority', text: '5 can be safely ignored.' },
      { label: 'Drafts ready', text: 'Replies prepared in your writing style. Waiting for approval.' },
    ],
  },
  {
    id: 2,
    userMessage: 'Plan my week.',
    responses: [
      { label: 'Calendar analyzed', text: '14 events across 5 days.' },
      { label: 'Conflicts detected', text: 'Tuesday 2pm and Thursday overlap with deep work blocks.' },
      { label: 'Better schedule', text: 'Reorganized for focus — mornings protected, meetings batched.' },
      { label: 'Priorities set', text: 'Top 3 goals surfaced. Everything else deprioritized.' },
    ],
  },
]

function ConversationCard({
  example,
  inView,
  delay,
}: {
  example: (typeof examples)[0]
  inView: boolean
  delay: number
}) {
  return (
    <motion.div
      className="flex-1 rounded-2xl border border-white/6 bg-[#0a0a0a] overflow-hidden"
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Card header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
        <div className="w-2 h-2 rounded-full bg-[#9b8fff] opacity-70" />
        <span className="text-xs text-[#3a3a3a] tracking-wide">Uyra</span>
      </div>

      <div className="p-6 space-y-5">
        {/* User message */}
        <div className="flex justify-end">
          <div className="bg-white/6 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%]">
            <p className="text-[#e8e8e8] text-sm">{example.userMessage}</p>
          </div>
        </div>

        {/* Uyra response */}
        <div className="flex gap-3">
          <div className="w-6 h-6 rounded-full bg-[#1a1a1a] border border-white/8 flex items-center justify-center flex-shrink-0 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-[#9b8fff]" />
          </div>
          <div className="flex-1 space-y-2">
            {example.responses.map((item, i) => (
              <motion.div
                key={item.label}
                className="bg-[#0f0f0f] rounded-xl rounded-tl-sm px-4 py-3 border border-white/4"
                initial={{ opacity: 0, x: -8 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: delay + 0.2 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="text-xs tracking-widest uppercase text-[#555] mr-2">
                  {item.label}
                </span>
                <span className="text-[#c4c4c4] text-sm">{item.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Approval prompt */}
        <motion.div
          className="flex items-center gap-3 pl-9"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: delay + 0.7 }}
        >
          <span className="text-[#3a3a3a] text-xs">Nothing sent. Waiting for your approval.</span>
          <div className="flex gap-2 ml-auto">
            <button className="px-3 py-1 rounded-full border border-white/8 text-[#7a7a7a] text-xs hover:border-white/15 hover:text-[#f8f8f8] transition-all duration-200">
              Review
            </button>
            <button className="px-3 py-1 rounded-full bg-white/6 text-[#f8f8f8] text-xs hover:bg-white/10 transition-all duration-200">
              Approve
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default function MeetYouraSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <section ref={ref} className="relative py-40 px-6 overflow-hidden">
      <div className="section-line absolute top-0 left-0 right-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_40%,rgba(80,60,180,0.04)_0%,transparent_70%)] pointer-events-none" />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="max-w-2xl mb-16">
          <motion.p
            className="text-xs tracking-widest uppercase text-[#555] mb-6"
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
          >
            Meet Your Uyra
          </motion.p>
          <motion.h2
            className="text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[#f8f8f8] mb-5"
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            One sentence.
            <br />
            <span className="text-[#3a3a3a]">Everything handled.</span>
          </motion.h2>
          <motion.p
            className="text-[#7a7a7a] text-lg leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Uyra understands what you mean, acts with your judgment, and never does anything without your approval.
          </motion.p>
        </div>

        {/* Two conversation cards */}
        <div className="flex flex-col lg:flex-row gap-4">
          {examples.map((example, i) => (
            <ConversationCard
              key={example.id}
              example={example}
              inView={inView}
              delay={0.25 + i * 0.15}
            />
          ))}
        </div>

        {/* Bottom note */}
        <motion.p
          className="text-center text-[#2a2a2a] text-sm mt-10 tracking-wide"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.9 }}
        >
          Always transparent. Always in control.
        </motion.p>
      </div>
    </section>
  )
}
