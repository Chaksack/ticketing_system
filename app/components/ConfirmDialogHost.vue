<script setup lang="ts">
const { state, settle } = useConfirm()
</script>

<template>
  <AlertDialog :open="state.open" @update:open="(open) => !open && settle(false)">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ state.title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="state.description">
          {{ state.description }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="settle(false)">
          Cancel
        </AlertDialogCancel>
        <Button :variant="state.destructive ? 'destructive' : 'default'" @click="settle(true)">
          {{ state.confirmLabel ?? 'Confirm' }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
