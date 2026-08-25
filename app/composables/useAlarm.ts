let audioCtx: AudioContext | null = null
let intervalId: ReturnType<typeof setInterval> | null = null

function beep() {
  if (!audioCtx)
    return

  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'square'
  osc.frequency.value = 880
  gain.gain.value = 0.15
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start()
  osc.stop(audioCtx.currentTime + 0.25)
}

export function useAlarm() {
  const isAlarming = useState('alarm-active', () => false)

  function start() {
    if (!import.meta.client || isAlarming.value)
      return

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextCtor)
      return

    isAlarming.value = true
    audioCtx = new AudioContextCtor()
    beep()
    intervalId = setInterval(beep, 800)
  }

  function stop() {
    isAlarming.value = false

    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }

    if (audioCtx) {
      audioCtx.close()
      audioCtx = null
    }
  }

  return { isAlarming, start, stop }
}
