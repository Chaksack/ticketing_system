<script setup lang="ts">
definePageMeta({
  layout: 'blank',
})
</script>

<template>
  <LayoutAuth reverse>
    <div class="grid mx-auto max-w-sm gap-6">
      <div class="grid gap-2 text-center">
        <h1 class="text-3xl font-black tracking-[-0.04em] text-foreground">
          Welcome back
        </h1>
        <!-- <p class="text-balance text-sm text-muted-foreground">
          Login with your Apple or Google account
        </p> -->
      </div>
      <AuthSignIn />
      <p class="text-center text-sm text-muted-foreground">
        New to Canopy?
        <NuxtLink to="/signup" class="font-semibold text-foreground underline underline-offset-2">
          Create a workspace
        </NuxtLink>
      </p>
    </div>
  </LayoutAuth>
</template>
