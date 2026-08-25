let audioCtx: AudioContext | null = null
let intervalId: ReturnType<typeof setInterval> | null = null

function getAudioContext() {
  if (!import.meta.client)
    return null

  if (!audioCtx) {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextCtor)
      return null
    audioCtx = new AudioContextCtor()
  }

  return audioCtx
}

/**
 * Browsers only allow audio to play after a real user gesture (click/keydown/touch) — an
 * AudioContext created later, in response to a service-worker push message, starts suspended
 * and produces no sound at all even though start()/stop() calls succeed silently. Call this
 * once from an actual gesture handler so the context is already unlocked by the time an alarm
 * needs to fire.
 */
export function unlockAlarmAudio() {
  const ctx = getAudioContext()
  if (ctx?.state === 'suspended')
    ctx.resume().catch(() => {})
}

function tone(ctx: AudioContext, frequency: number, startOffset: number, duration: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = frequency
  gain.gain.value = 0.2
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(ctx.currentTime + startOffset)
  osc.stop(ctx.currentTime + startOffset + duration)
}

function beep(ctx: AudioContext) {
  // Two alternating tones read as an "alarm" rather than a single flat blip.
  tone(ctx, 880, 0, 0.25)
  tone(ctx, 660, 0.3, 0.25)
}

export function useAlarm() {
  const isAlarming = useState('alarm-active', () => false)

  function start() {
    if (isAlarming.value)
      return

    const ctx = getAudioContext()
    if (!ctx)
      return

    isAlarming.value = true

    const tick = () => {
      if (ctx.state === 'suspended')
        ctx.resume().catch(() => {})
      beep(ctx)
    }

    tick()
    intervalId = setInterval(tick, 900)
  }

  function stop() {
    isAlarming.value = false

    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  return { isAlarming, start, stop }
}
