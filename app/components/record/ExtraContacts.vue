<script setup lang="ts">
/** Extra emails and phone numbers for the same contact person (work + personal, etc.). */
const props = defineProps<{
  emails: { id: string, email: string, label?: string }[]
  phones: { id: string, phone: string, label?: string }[]
  addEmail: (value: { email: string, label?: string }) => Promise<unknown>
  removeEmail: (id: string) => Promise<unknown>
  addPhone: (value: { phone: string, label?: string }) => Promise<unknown>
  removePhone: (id: string) => Promise<unknown>
}>()

const email = reactive({ value: '', label: '' })
const phone = reactive({ value: '', label: '' })

async function onAddEmail() {
  if (!email.value.trim())
    return
  await props.addEmail({ email: email.value.trim(), label: email.label.trim() || undefined })
  email.value = ''
  email.label = ''
}
async function onAddPhone() {
  if (!phone.value.trim())
    return
  await props.addPhone({ phone: phone.value.trim(), label: phone.label.trim() || undefined })
  phone.value = ''
  phone.label = ''
}
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <div class="flex flex-col gap-1.5">
      <Label class="text-[13px] font-semibold">More emails</Label>
      <div v-for="item in emails" :key="item.id" class="flex items-center gap-2 text-sm">
        <span class="flex-1 truncate">{{ item.email }}</span>
        <Badge v-if="item.label" variant="outline" class="text-[10px]">
          {{ item.label }}
        </Badge>
        <Button size="icon-sm" variant="ghost" :aria-label="`Remove ${item.email}`" @click="removeEmail(item.id)">
          <Icon name="i-lucide-x" class="size-3.5" />
        </Button>
      </div>
      <form class="flex gap-1.5" @submit.prevent="onAddEmail">
        <Input v-model="email.value" type="email" placeholder="another@company.com" class="min-w-0 flex-1" aria-label="Extra email" />
        <Input v-model="email.label" placeholder="Label" class="w-24" aria-label="Email label" />
        <Button type="submit" size="icon" variant="outline" aria-label="Add email" :disabled="!email.value.trim()">
          <Icon name="i-lucide-plus" />
        </Button>
      </form>
    </div>
    <div class="flex flex-col gap-1.5">
      <Label class="text-[13px] font-semibold">More phone numbers</Label>
      <div v-for="item in phones" :key="item.id" class="flex items-center gap-2 text-sm">
        <span class="flex-1 truncate">{{ item.phone }}</span>
        <Badge v-if="item.label" variant="outline" class="text-[10px]">
          {{ item.label }}
        </Badge>
        <Button size="icon-sm" variant="ghost" :aria-label="`Remove ${item.phone}`" @click="removePhone(item.id)">
          <Icon name="i-lucide-x" class="size-3.5" />
        </Button>
      </div>
      <form class="flex gap-1.5" @submit.prevent="onAddPhone">
        <Input v-model="phone.value" placeholder="+233 24 000 0000" class="min-w-0 flex-1" aria-label="Extra phone" />
        <Input v-model="phone.label" placeholder="Label" class="w-24" aria-label="Phone label" />
        <Button type="submit" size="icon" variant="outline" aria-label="Add phone" :disabled="!phone.value.trim()">
          <Icon name="i-lucide-plus" />
        </Button>
      </form>
    </div>
  </div>
</template>
