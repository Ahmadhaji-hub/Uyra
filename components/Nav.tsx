'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'

export default function Nav() {
  const { scrollY } = useScroll()
  const bgOpacity = useTransform(scrollY, [0, 80], [0, 0.88])
  const borderOpacity = useTransform(scrollY, [0, 80], [0, 0.07])

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12"
      style={{
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
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

      {/* Desktop */}
      <div className="relative max-w-7xl mx-auto hidden md:flex items-center justify-between h-20">

        {/* Logo */}
        <motion.a
          href="/"
          className="text-[#f8f8f8] text-lg font-semibold tracking-tight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          Uyra
        </motion.a>

        {/* Right group: links + button */}
        <motion.div
          className="flex items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <a href="#how-it-works" className="px-4 py-2 text-sm text-[#7a7a7a] hover:text-[#f8f8f8] transition-colors duration-200 rounded-lg hover:bg-white/4">
            How it works
          </a>
          <a href="#future" className="px-4 py-2 text-sm text-[#7a7a7a] hover:text-[#f8f8f8] transition-colors duration-200 rounded-lg hover:bg-white/4">
            Vision
          </a>
          <Link href="/manifest" className="px-4 py-2 text-sm text-[#7a7a7a] hover:text-[#f8f8f8] transition-colors duration-200 rounded-lg hover:bg-white/4">
            Manifest
          </Link>

          <div className="w-px h-4 bg-white/8 mx-2" />

          <a
            href="#waitlist"
            className="px-5 py-2 text-sm rounded-full border border-white/12 text-[#f8f8f8] hover:bg-white/6 hover:border-white/20 transition-all duration-200"
          >
            Join Waitlist
          </a>
        </motion.div>
      </div>

      {/* Mobile */}
      <div className="relative md:hidden">
        <div className="flex items-center justify-between h-14">
          <motion.a
            href="/"
            className="text-[#f8f8f8] text-base font-semibold tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            Uyra
          </motion.a>
          <motion.a
            href="#waitlist"
            className="px-4 py-1.5 text-xs rounded-full border border-white/10 text-[#f8f8f8] hover:bg-white/5 transition-all duration-200"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Join Waitlist
          </motion.a>
        </div>
        <motion.div
          className="flex items-center justify-center gap-6 text-xs text-[#555] pb-2.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <a href="#how-it-works" className="hover:text-[#f8f8f8] transition-colors duration-200">How it works</a>
          <a href="#future" className="hover:text-[#f8f8f8] transition-colors duration-200">Vision</a>
          <Link href="/manifest" className="hover:text-[#f8f8f8] transition-colors duration-200">Manifest</Link>
        </motion.div>
      </div>

    </motion.header>
  )
}
