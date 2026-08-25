export default defineNuxtPlugin(() => {
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
