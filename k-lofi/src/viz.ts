/** Visualizador de 20 barras junto al rótulo de la emisora. */
const BARS = 20
const COLORS = ['#e0693c', '#ffcf99', '#e8a1b0', '#9a86c9', '#4ec9c9']

export function mountViz(canvas: HTMLCanvasElement, getSpectrum: () => Float32Array | null) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const smooth = new Float32Array(BARS)

  const frame = () => {
    requestAnimationFrame(frame)
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    if (cssW === 0 || cssH === 0) return
    const dpr = Math.min(devicePixelRatio || 1, 2)
    if (canvas.width !== Math.round(cssW * dpr)) {
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
    }

    const data = getSpectrum()
    const t = performance.now() / 1000

    for (let i = 0; i < BARS; i++) {
      let target: number
      if (data && data.length) {
        // escala logarítmica: las barras bajas cubren menos bins
        const usable = data.length * 0.8
        const lo = Math.floor(Math.pow(i / BARS, 1.6) * usable)
        const hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / BARS, 1.6) * usable))
        let sum = 0
        for (let k = lo; k < hi; k++) sum += data[k]
        const db = sum / (hi - lo) // dBFS, típicamente -100..0
        target = Math.pow(Math.max(0, (db + 100) / 100), 1.35)
      } else {
        target = 0.05 + Math.max(0, Math.sin(t * 1.4 + i * 0.55)) * 0.05
      }
      smooth[i] += (target - smooth[i]) * (target > smooth[i] ? 0.42 : 0.13)
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)
    const gap = 2
    const w = (cssW - gap * (BARS - 1)) / BARS
    for (let i = 0; i < BARS; i++) {
      const h = Math.max(2, smooth[i] * (cssH - 4))
      ctx.fillStyle = COLORS[Math.min(COLORS.length - 1, Math.floor((i / BARS) * COLORS.length))]
      ctx.fillRect(i * (w + gap), cssH - 2 - h, w, h)
    }
  }
  requestAnimationFrame(frame)
}

/** Energía media 0..1, para que la escena reaccione a la música. */
export function energyOf(data: Float32Array | null): number {
  if (!data || !data.length) return 0
  let sum = 0
  const n = Math.floor(data.length * 0.5)
  for (let i = 0; i < n; i++) sum += Math.max(0, (data[i] + 100) / 100)
  return Math.min(1, sum / n)
}
