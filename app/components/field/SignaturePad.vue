<script setup lang="ts">
/** Finger/mouse signature on a canvas; emits a PNG blob. */
const emit = defineEmits<{ save: [png: Blob] }>()

const canvas = ref<HTMLCanvasElement>()
const hasInk = ref(false)
let drawing = false

function context() {
  const ctx = canvas.value?.getContext('2d')
  if (ctx) {
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0e0f0c'
  }
  return ctx
}

function point(event: PointerEvent) {
  const rect = canvas.value!.getBoundingClientRect()
  return { x: (event.clientX - rect.left) * (canvas.value!.width / rect.width), y: (event.clientY - rect.top) * (canvas.value!.height / rect.height) }
}

function down(event: PointerEvent) {
  const ctx = context()
  if (!ctx)
    return
  drawing = true
  canvas.value!.setPointerCapture(event.pointerId)
  const { x, y } = point(event)
  ctx.beginPath()
  ctx.moveTo(x, y)
}
function move(event: PointerEvent) {
  if (!drawing)
    return
  const ctx = context()!
  const { x, y } = point(event)
  ctx.lineTo(x, y)
  ctx.stroke()
  hasInk.value = true
}
function up() {
  drawing = false
}
function clear() {
  const ctx = context()
  ctx?.clearRect(0, 0, canvas.value!.width, canvas.value!.height)
  hasInk.value = false
}
function save() {
  canvas.value?.toBlob(blob => blob && emit('save', blob), 'image/png')
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <canvas
      ref="canvas"
      width="700"
      height="260"
      class="h-[180px] w-full touch-none rounded-2xl border-2 border-dashed border-brand-forest bg-white"
      aria-label="Signature area: sign with your finger or mouse"
      role="img"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointerleave="up"
    />
    <div class="flex justify-between gap-2">
      <Button type="button" variant="ghost" size="sm" :disabled="!hasInk" @click="clear">
        Clear
      </Button>
      <Button type="button" size="sm" :disabled="!hasInk" @click="save">
        Save signature
      </Button>
    </div>
  </div>
</template>
