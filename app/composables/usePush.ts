function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

export function usePush() {
  const isSubscribed = useState('push-subscribed', () => false)
  const isSupported = import.meta.client && 'serviceWorker' in navigator && 'PushManager' in window

  async function checkSubscription() {
    if (!isSupported)
      return

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    isSubscribed.value = !!subscription
  }

  async function subscribe() {
    if (!isSupported)
      throw new Error('Push notifications are not supported in this browser.')

    const permission = await Notification.requestPermission()
    if (permission !== 'granted')
      throw new Error('Notification permission was denied.')

    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const config = useRuntimeConfig()
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.public.vapidPublicKey),
    })

    await $fetch('/api/push/subscribe', {
      method: 'POST',
      body: subscription.toJSON(),
    })

    isSubscribed.value = true
  }

  async function unsubscribe() {
    if (!isSupported)
      return

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      await $fetch('/api/push/unsubscribe', {
        method: 'POST',
        body: { endpoint: subscription.endpoint },
      })
      await subscription.unsubscribe()
    }

    isSubscribed.value = false
  }

  return { isSupported, isSubscribed, checkSubscription, subscribe, unsubscribe }
}
