/**
 * Capa ambiental: lluvia en el cristal y crujido de vinilo.
 *
 * Esto NO es Strudel a propósito. Son texturas continuas, no eventos rítmicos,
 * así que viven en WebAudio puro colgadas del mismo AudioContext que usa
 * Strudel (`getAudioContext()`), y así comparten reloj y salida.
 */

export class Ambience {
  private ctx: AudioContext
  private out: GainNode
  private rainGain: GainNode
  private crackleGain: GainNode
  private started = false
  private volume = 1
  private muted = false

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = 1
    this.out.connect(ctx.destination)

    this.rainGain = ctx.createGain()
    this.rainGain.gain.value = 0
    this.rainGain.connect(this.out)

    this.crackleGain = ctx.createGain()
    this.crackleGain.gain.value = 0
    this.crackleGain.connect(this.out)
  }

  /** Arranca los bucles de ruido (idempotente). */
  start() {
    if (this.started) return
    this.started = true
    const ctx = this.ctx
    const noise = this.noiseBuffer(2.5)

    // lluvia: una capa grave de "manta" + una banda media de gotas
    const body = ctx.createBufferSource()
    body.buffer = noise
    body.loop = true
    const bodyLp = ctx.createBiquadFilter()
    bodyLp.type = 'lowpass'
    bodyLp.frequency.value = 900
    body.connect(bodyLp).connect(this.rainGain)
    body.start()

    const drops = ctx.createBufferSource()
    drops.buffer = noise
    drops.loop = true
    drops.playbackRate.value = 0.86
    const dropsBp = ctx.createBiquadFilter()
    dropsBp.type = 'bandpass'
    dropsBp.frequency.value = 3100
    dropsBp.Q.value = 1.6
    const dropsGain = ctx.createGain()
    dropsGain.gain.value = 0.28
    drops.connect(dropsBp).connect(dropsGain).connect(this.rainGain)
    drops.start()

    // respiración lenta del chaparrón
    const breath = ctx.createOscillator()
    breath.frequency.value = 0.07
    const breathDepth = ctx.createGain()
    breathDepth.gain.value = 0.03
    breath.connect(breathDepth).connect(this.rainGain.gain)
    breath.start()

    // crujido de vinilo: ruido muy bajo con chasquidos esporádicos
    const crackle = ctx.createBufferSource()
    crackle.buffer = this.crackleBuffer(3)
    crackle.loop = true
    const crackleBp = ctx.createBiquadFilter()
    crackleBp.type = 'bandpass'
    crackleBp.frequency.value = 2400
    crackleBp.Q.value = 0.5
    crackle.connect(crackleBp).connect(this.crackleGain)
    crackle.start()
  }

  /** rain y tapeWear van de 0 a 100. */
  set(rain: number, tapeWear: number) {
    const t = this.ctx.currentTime
    this.rainGain.gain.setTargetAtTime((rain / 100) * 0.34, t, 0.3)
    this.crackleGain.gain.setTargetAtTime((tapeWear / 100) * 0.32, t, 0.2)
  }

  /** Silencia la ambientación sin destruir los bucles. */
  mute(muted: boolean) {
    this.muted = muted
    this.applyOutput()
  }

  /** Volumen general, de 0 a 1. */
  setVolume(volume: number) {
    this.volume = volume
    this.applyOutput()
  }

  private applyOutput() {
    const target = this.muted ? 0.0001 : Math.max(0.0001, this.volume)
    this.out.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12)
  }

  private noiseBuffer(seconds: number) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  private crackleBuffer(seconds: number) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      let v = (Math.random() * 2 - 1) * 0.016
      if (Math.random() < 0.0011) {
        const p = Math.random()
        v += (Math.random() * 2 - 1) * p * p * 0.5
      }
      data[i] = v
    }
    return buf
  }
}
