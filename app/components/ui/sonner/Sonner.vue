<script lang="ts" setup>
import type { ToasterProps } from 'vue-sonner'
import { Toaster as Sonner } from 'vue-sonner'

const props = defineProps<ToasterProps>()
</script>

<template>
  <Sonner
    class="toaster group"
    v-bind="props"
    :style="{
      '--normal-bg': '#16a34a',
      '--normal-text': '#ffffff',
      '--normal-border': '#15803d',
      '--error-bg': '#7f1d1d',
      '--error-text': '#ffffff',
      '--error-border': '#450a0a',
    }"
  />
</template>

<style>
[data-sonner-toaster] [data-sonner-toast]::before {
  content: '';
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  background-color: #fff;
  background-image: url('/icons/logo.png');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  border-radius: 6px;
}

[data-sonner-toaster] [data-sonner-toast] [data-description] {
  color: #ffffff !important;
}
</style>
