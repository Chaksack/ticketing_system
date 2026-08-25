self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})

self.addEventListener('push', (event) => {
  if (!event.data)
    return

  let payload = {}
  try {
    payload = event.data.json()
  }
  catch {
    payload = { title: 'IBS Ticketing System', body: event.data.text() }
  }

  const title = payload.title || 'IBS Ticketing System'
  const isPage = payload.type === 'page'
  const options = {
    body: payload.body || '',
    icon: '/favicon.ico',
    tag: payload.tag,
    data: { url: payload.url || '/', type: payload.type, tag: payload.tag },
    // Pager-style pages stay on screen (don't auto-dismiss) and vibrate until acknowledged.
    requireInteraction: isPage,
    vibrate: isPage ? [300, 150, 300, 150, 300] : undefined,
  }

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      if (!isPage)
        return

      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients)
          client.postMessage({ type: 'start-alarm', tag: payload.tag })
      })
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  const tag = event.notification.data?.tag

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList)
        client.postMessage({ type: 'stop-alarm', tag })

      for (const client of clientsList) {
        if (client.url.includes(url) && 'focus' in client)
          return client.focus()
      }
      if (self.clients.openWindow)
        return self.clients.openWindow(url)
    }),
  )
})
