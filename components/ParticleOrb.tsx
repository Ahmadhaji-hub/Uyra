'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  theta: number
  phi: number
  r: number
  baseR: number
  speed: number
  size: number
  opacity: number
  opacitySpeed: number
  drift: number
  driftSpeed: number
  driftPhase: number
}

export default function ParticleOrb() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const timeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let W = 0
    let H = 0

    const resize = () => {
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)
    }
    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    // Build particles
    const COUNT = 520
    const particles: Particle[] = []

    for (let i = 0; i < COUNT; i++) {
      // Fibonacci sphere distribution
      const goldenAngle = Math.PI * (3 - Math.sqrt(5))
      const y = 1 - (i / (COUNT - 1)) * 2
      const radius = Math.sqrt(1 - y * y)
      const theta = goldenAngle * i

      const phi = Math.acos(y)
      const baseR = 0.85 + Math.random() * 0.3

      particles.push({
        theta,
        phi,
        r: baseR,
        baseR,
        speed: (Math.random() - 0.5) * 0.00025,
        size: Math.random() < 0.08 ? 1.8 + Math.random() * 1.2 : 0.6 + Math.random() * 0.8,
        opacity: 0.1 + Math.random() * 0.7,
        opacitySpeed: (Math.random() - 0.5) * 0.003,
        drift: 0,
        driftSpeed: 0.0003 + Math.random() * 0.0008,
        driftPhase: Math.random() * Math.PI * 2,
      })
    }

    // Connection pairs for subtle lines
    const connections: [number, number][] = []
    for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        const dPhi = Math.abs(particles[i].phi - particles[j].phi)
        const dTheta = Math.abs(particles[i].theta - particles[j].theta)
        if (dPhi < 0.18 && dTheta < 0.18 && connections.length < 280) {
          connections.push([i, j])
        }
      }
    }

    const draw = () => {
      timeRef.current += 0.008
      const t = timeRef.current
      ctx.clearRect(0, 0, W, H)

      const cx = W / 2
      const cy = H / 2
      const R = Math.min(W, H) * 0.36

      // Outer glow
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5)
      grad.addColorStop(0, 'rgba(180, 160, 255, 0.025)')
      grad.addColorStop(0.5, 'rgba(140, 140, 255, 0.012)')
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.5, 0, Math.PI * 2)
      ctx.fill()

      // Auto-rotate
      const rotY = t * 0.12
      const rotX = Math.sin(t * 0.05) * 0.18

      // Project 3D → 2D for each particle
      const projected: { x: number; y: number; z: number; idx: number }[] = []

      for (let i = 0; i < COUNT; i++) {
        const p = particles[i]

        // Update
        p.theta += p.speed
        p.opacity += p.opacitySpeed
        if (p.opacity > 0.85 || p.opacity < 0.05) p.opacitySpeed *= -1

        p.drift = Math.sin(t * p.driftSpeed * 100 + p.driftPhase) * 0.08
        p.r = p.baseR + p.drift

        // 3D position on sphere
        const x0 = p.r * Math.sin(p.phi) * Math.cos(p.theta + rotY)
        const y0 = p.r * Math.cos(p.phi)
        const z0 = p.r * Math.sin(p.phi) * Math.sin(p.theta + rotY)

        // Rotate X
        const y1 = y0 * Math.cos(rotX) - z0 * Math.sin(rotX)
        const z1 = y0 * Math.sin(rotX) + z0 * Math.cos(rotX)

        // Perspective
        const fov = 2.8
        const pz = fov + z1
        const px = cx + (x0 * R * fov) / pz
        const py = cy + (y1 * R * fov) / pz

        projected.push({ x: px, y: py, z: z1, idx: i })
      }

      // Draw connections
      ctx.lineWidth = 0.4
      for (const [i, j] of connections) {
        const a = projected[i]
        const b = projected[j]
        const avgZ = (a.z + b.z) / 2
        const visibility = (avgZ + 1) / 2
        if (visibility < 0.2) continue

        const alpha = visibility * particles[i].opacity * particles[j].opacity * 0.18
        ctx.strokeStyle = `rgba(200, 190, 255, ${alpha})`
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      // Draw particles
      for (let i = 0; i < COUNT; i++) {
        const { x, y, z, idx } = projected[i]
        const p = particles[idx]
        const visibility = (z + 1) / 2
        if (visibility < 0.05) continue

        const alpha = visibility * p.opacity
        const size = p.size * (0.5 + visibility * 0.8)

        // Core dot
        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(230, 225, 255, ${alpha * 0.9})`
        ctx.fill()

        // Glow for larger particles
        if (p.size > 1.5) {
          const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 4)
          glow.addColorStop(0, `rgba(200, 180, 255, ${alpha * 0.3})`)
          glow.addColorStop(1, 'transparent')
          ctx.beginPath()
          ctx.arc(x, y, size * 4, 0, Math.PI * 2)
          ctx.fillStyle = glow
          ctx.fill()
        }
      }

      // Central core glow
      const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.35)
      coreGlow.addColorStop(0, `rgba(220, 210, 255, ${0.04 + Math.sin(t * 0.7) * 0.015})`)
      coreGlow.addColorStop(1, 'transparent')
      ctx.beginPath()
      ctx.arc(cx, cy, R * 0.35, 0, Math.PI * 2)
      ctx.fillStyle = coreGlow
      ctx.fill()

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      observer.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  )
}
