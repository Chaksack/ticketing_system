export default defineNuxtPlugin(() => {
  // Web Audio needs a real user gesture before it's allowed to produce sound; without this,
  // an alarm triggered later by a service-worker push message would be silently muted.
  const unlock = () => unlockAlarmAudio()
  document.addEventListener('pointerdown', unlock, { once: true })
  document.addEventListener('keydown', unlock, { once: true })

  if (!('serviceWorker' in navigator))
    return

  navigator.serviceWorker.register('/sw.js').catch(() => {})

  const { start, stop } = useAlarm()

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'start-alarm')
      start()
    else if (event.data?.type === 'stop-alarm')
      stop()
  })
})
