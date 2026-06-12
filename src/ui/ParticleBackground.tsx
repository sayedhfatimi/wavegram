// Ambient canvas background — slowly drifting particles connected by faint lines, with a subtle
// parallax response to the cursor. Mounted once in App; sits fixed at z-0 so content scrolls over
// a stationary field (the page background is opaque but painted below this canvas).
//
// Adapted from the vocasync dashboard ParticleBackground. Two changes: it takes the active theme
// as a prop (wavegram's useTheme is useState-based, so calling it again here would desync from the
// header toggle), and particle colours are sampled from the logo gradient instead of one accent.

import { useCallback, useEffect, useRef } from 'react'
import type { Theme } from '@/ui/lib/useTheme'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
  color: string
}

// Logo gradient, left to right: cyan -> blue -> violet -> magenta -> pink (rgb triples).
const PALETTE = [
  '45, 212, 224', // cyan
  '56, 132, 246', // blue
  '139, 92, 246', // violet
  '199, 70, 210', // purple-magenta
  '240, 70, 165', // pink
]
// Connection lines stay on the brand violet so the web reads as one colour.
const CONNECTION_COLOR = '139, 92, 246'

interface ParticleBackgroundProps {
  theme: Theme
  particleCount?: number
  connectionDistance?: number
  speed?: number
  maxOpacity?: number
  showConnections?: boolean
  mouseInteraction?: boolean
}

export function ParticleBackground({
  theme,
  particleCount = 80,
  connectionDistance = 120,
  speed = 0.3,
  maxOpacity = 0.5,
  showConnections = true,
  mouseInteraction = true,
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number>(0)
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const isDark = theme === 'dark'

  const initParticles = useCallback(
    (width: number, height: number) => {
      const particles: Particle[] = []
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * speed,
          vy: (Math.random() - 0.5) * speed,
          radius: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * maxOpacity + 0.1,
          color: PALETTE[i % PALETTE.length],
        })
      }
      particlesRef.current = particles
    },
    [particleCount, speed, maxOpacity],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Saturated logo colours read on both themes; scale alpha down on the light background so the
    // field stays a subtle ambience rather than a distraction.
    const alphaScale = isDark ? 1 : 0.7
    const connectionBase = isDark ? 0.16 : 0.12

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)

      if (particlesRef.current.length === 0) {
        initParticles(window.innerWidth, window.innerHeight)
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    const animate = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.clearRect(0, 0, w, h)

      const particles = particlesRef.current
      const mouse = mouseRef.current

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0

        if (mouseInteraction) {
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 150) {
            const force = (150 - dist) / 150
            p.vx += (dx / dist) * force * 0.02
            p.vy += (dy / dist) * force * 0.02
          }
        }

        const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (currentSpeed > speed * 2) {
          p.vx *= 0.98
          p.vy *= 0.98
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${p.color},${p.opacity * alphaScale})`
        ctx.fill()
      }

      if (showConnections) {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x
            const dy = particles[i].y - particles[j].y
            const dist = Math.sqrt(dx * dx + dy * dy)

            if (dist < connectionDistance) {
              const opacity = (1 - dist / connectionDistance) * connectionBase
              ctx.beginPath()
              ctx.moveTo(particles[i].x, particles[i].y)
              ctx.lineTo(particles[j].x, particles[j].y)
              ctx.strokeStyle = `rgba(${CONNECTION_COLOR},${opacity})`
              ctx.lineWidth = 0.5
              ctx.stroke()
            }
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    resize()
    animate()
    window.addEventListener('resize', resize)
    if (mouseInteraction) {
      window.addEventListener('mousemove', handleMouseMove)
    }

    return () => {
      cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [
    initParticles,
    showConnections,
    connectionDistance,
    mouseInteraction,
    speed,
    isDark,
  ])

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" />
}
