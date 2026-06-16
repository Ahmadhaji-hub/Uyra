'use client'

import { motion, useScroll, useTransform } from 'framer-motion'

export default function Nav() {
  const { scrollY } = useScroll()
  const bgOpacity = useTransform(scrollY, [0, 80], [0, 0.85])
  const borderOpacity = useTransform(scrollY, [0, 80], [0, 0.06])

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12"
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <motion.div
        className="absolute inset-0 bg-[#050505]"
        style={{ opacity: bgOpacity }}
      />
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px bg-white"
        style={{ opacity: borderOpacity }}
      />
      <div className="relative max-w-7xl mx-auto flex items-center justify-between h-16 md:h-20">
        <motion.a
          href="#"
          className="text-[#f8f8f8] text-lg font-semibold tracking-tight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          Uyra
        </motion.a>

        <motion.div
          className="hidden md:flex items-center gap-8 text-sm text-[#7a7a7a]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <a href="#how-it-works" className="hover:text-[#f8f8f8] transition-colors duration-200">How it works</a>
          <a href="#future" className="hover:text-[#f8f8f8] transition-colors duration-200">Vision</a>
        </motion.div>

        <motion.a
          href="#waitlist"
          className="text-sm px-5 py-2 rounded-full border border-white/10 text-[#f8f8f8] hover:bg-white/5 transition-all duration-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Join Waitlist
        </motion.a>
      </div>
    </motion.header>
  )
}
