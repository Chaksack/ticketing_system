/*
 * Canopy website chat. Add to any page:
 *   <script src="https://YOUR-CANOPY-ADDRESS/widget.js" data-workspace="your-workspace" async></script>
 * Optional: data-label="Chat with us" data-color="#163300" data-position="left"
 */
(function () {
  const script = document.currentScript
  if (!script || window.__canopyChat)
    return
  window.__canopyChat = true
  const origin = new URL(script.src).origin
  const workspace = script.getAttribute('data-workspace') || 'canopy'
  const label = script.getAttribute('data-label') || 'Chat with us'
  const color = script.getAttribute('data-color') || '#163300'
  const side = script.getAttribute('data-position') === 'left' ? 'left' : 'right'

  const frame = document.createElement('iframe')
  frame.src = `${origin}/widget/${encodeURIComponent(workspace)}`
  frame.title = 'Live chat'
  frame.setAttribute('allow', 'clipboard-write')
  frame.style.cssText = `position:fixed;bottom:88px;${side}:20px;width:min(380px,calc(100vw - 32px));height:min(600px,calc(100vh - 120px));border:0;border-radius:24px;box-shadow:0 10px 40px rgba(0,0,0,.2);background:#fff;z-index:2147483646;display:none`

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.setAttribute('aria-expanded', 'false')
  button.style.cssText = `position:fixed;bottom:20px;${side}:20px;min-height:52px;padding:0 22px;border:0;border-radius:999px;background:${color};color:#9fe870;font:600 15px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.2);z-index:2147483647`
  button.addEventListener('click', () => {
    const open = frame.style.display === 'none'
    frame.style.display = open ? 'block' : 'none'
    button.textContent = open ? 'Close chat' : label
    button.setAttribute('aria-expanded', String(open))
  })

  document.body.appendChild(frame)
  document.body.appendChild(button)
})()
