<script setup lang="ts">
defineProps<{
  reverse?: boolean
}>()
</script>

<template>
  <div
    class="relative flex items-center justify-center px-4 h-dvh lg:max-w-none lg:px-0"
    :class="{ 'flex-row-reverse': reverse }"
  >
    <div class="relative hidden h-full flex-1 flex-col justify-between bg-brand-forest p-12 text-white lg:flex">
      <NuxtLink to="/" aria-label="Canopy home" class="flex items-center">
        <BrandLogo tone="dark" :size="36" />
      </NuxtLink>
      <div class="flex flex-col gap-6">
        <BrandLogo tone="dark" :size="140" :wordmark="false" />
        <p class="m-0 text-[clamp(3rem,5vw,5rem)] font-black leading-[0.88] tracking-[-0.05em] text-brand-lime">
          Every customer.<br>Every team.<br>One canopy.
        </p>
        <p class="m-0 max-w-md text-lg leading-relaxed text-white">
          One roof for every customer relationship: support, sales, projects and reporting.
        </p>
      </div>
      <div class="text-sm text-brand-mist">
        The mark: a canopy arch over a single stem. Many teams, one record.
      </div>
    </div>
    <div class="mx-auto flex-1 lg:p-8">
      <slot />
    </div>
  </div>
</template>

<style scoped>

</style>
