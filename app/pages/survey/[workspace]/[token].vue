<script setup lang="ts">
// Public: the one-question satisfaction survey ("What the customer sees" in Case-Resolve).
definePageMeta({ layout: 'blank' })

const route = useRoute()
const workspace = computed(() => String(route.params.workspace))
const token = computed(() => String(route.params.token))
const { data, error } = await useFetch<{ subject: string, answered: boolean, rating?: number, companyName: string }>(() => `/api/public/surveys/${token.value}`, { query: { workspace } })
useSeoMeta({ title: 'How did we do?' })

const rating = ref<number | null>(null)
const comment = ref('')
const sent = ref(false)
const busy = ref(false)
const message = ref('')

async function submit() {
  if (!rating.value)
    return
  busy.value = true
  try {
    await $fetch(`/api/public/surveys/${token.value}`, { method: 'POST', query: { workspace: workspace.value }, body: { rating: rating.value, comment: comment.value } })
    sent.value = true
  }
  catch (e: any) {
    message.value = e?.data?.statusMessage ?? 'Something went wrong. Please try again.'
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-start justify-center bg-[#f6f7f5] px-4 py-12 font-sans text-[#454745]">
    <div class="flex w-full max-w-md flex-col gap-4 rounded-[28px] bg-white p-7 shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
      <template v-if="error">
        <h1 class="m-0 text-2xl font-black tracking-[-0.03em] text-brand-obsidian">
          This link isn't valid
        </h1>
        <p class="m-0">
          It may have been mistyped. Reply to the email you received instead and we'll pick it up.
        </p>
      </template>
      <template v-else-if="data">
        <div class="text-xl font-black tracking-[-0.03em] text-brand-forest">
          {{ data.companyName }} Support
        </div>
        <template v-if="sent || data.answered">
          <h1 class="m-0 text-2xl font-extrabold leading-tight tracking-[-0.02em] text-brand-obsidian">
            Thank you for your feedback.
          </h1>
          <p v-if="sent && rating && rating <= 2" class="m-0">
            We're sorry it didn't go well. We've reopened your request and someone will be in touch.
          </p>
        </template>
        <form v-else class="flex flex-col gap-4" @submit.prevent="submit">
          <h1 class="m-0 text-2xl font-extrabold leading-tight tracking-[-0.02em] text-brand-obsidian">
            How did we do with "{{ data.subject }}"?
          </h1>
          <div role="radiogroup" aria-label="Rating, 1 to 5" class="grid grid-cols-5 gap-1.5">
            <button
              v-for="n in 5"
              :key="n"
              type="button"
              role="radio"
              :aria-checked="rating === n"
              :aria-label="`${n} out of 5`"
              class="min-h-13 rounded-[14px] text-lg font-bold text-brand-forest"
              :class="rating === n ? 'border-2 border-brand-forest bg-brand-lime' : 'border border-[#868685] bg-white'"
              @click="rating = n"
            >
              {{ n }}
            </button>
          </div>
          <div class="flex justify-between text-xs text-[#6a6c6a]">
            <span>Very poor</span><span>Excellent</span>
          </div>
          <label class="flex flex-col gap-1.5 text-[13px] font-semibold">Anything else?
            <textarea v-model="comment" rows="3" placeholder="Optional" class="rounded-[10px] border border-[#868685] px-3.5 py-3 text-[15px] font-normal outline-none focus-visible:ring-2 focus-visible:ring-brand-forest" />
          </label>
          <p v-if="message" role="alert" class="m-0 text-sm font-semibold text-[#a11f26]">
            {{ message }}
          </p>
          <button type="submit" :disabled="!rating || busy" class="min-h-12 rounded-full bg-brand-forest text-[15px] font-semibold text-brand-lime disabled:opacity-60">
            Send feedback
          </button>
        </form>
      </template>
    </div>
  </div>
</template>
