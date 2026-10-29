<script setup lang="ts">
import type { SupportCustomerDetail } from '~/types/supportDesk'
import { toast } from 'vue-sonner'

// One customer: who they are, their cases and chats, how they rated us, and the team's notes.
definePageMeta({ middleware: 'agent' })

const route = useRoute()
const { isAdmin, isBd, isSm } = useAuth()
/** Client records are for sales and admins (the Clients page's own permission). */
const canOpenClients = computed(() => isAdmin.value || isBd.value || isSm.value)
const email = computed(() => decodeURIComponent(String(route.params.email)))
const customer = ref<SupportCustomerDetail | null>(null)
const notFound = ref(false)
const form = reactive({ name: '', phone: '', notes: '' })

async function load() {
  try {
    customer.value = (await fetchUntyped<{ customer: SupportCustomerDetail }>(`/api/service/customers/${encodeURIComponent(email.value)}`)).customer
    Object.assign(form, { name: customer.value.name, phone: customer.value.phone ?? '', notes: customer.value.notes ?? '' })
  }
  catch (error: any) {
    if (error?.statusCode === 404)
      notFound.value = true
  }
}
onMounted(load)

const isDirty = computed(() => !!customer.value && (form.name !== customer.value.name || form.phone !== (customer.value.phone ?? '') || form.notes !== (customer.value.notes ?? '')))
const saving = ref(false)
async function save() {
  saving.value = true
  try {
    await fetchUntyped(`/api/service/customers/${encodeURIComponent(email.value)}`, { method: 'PATCH', body: form })
    toast('Customer saved')
    await load()
  }
  catch (error: any) {
    toast.error('Not saved', { description: error?.data?.statusMessage })
  }
  finally {
    saving.value = false
  }
}
defineShortcuts({ meta_s: { usingInput: true, handler: () => isDirty.value && save() } })

const tab = ref('summary')
const related = computed(() => [
  { value: 'cases', label: 'Cases', count: customer.value?.tickets.length, icon: 'i-lucide-ticket' },
  { value: 'chats', label: 'Chats', count: customer.value?.chats.length, icon: 'i-lucide-messages-square' },
  { value: 'ratings', label: 'Ratings', count: customer.value?.surveys.length, icon: 'i-lucide-star' },
])
const stats = computed(() => customer.value
  ? [
      { label: 'Cases', value: String(customer.value.ticketCount) },
      { label: 'Open', value: String(customer.value.openTickets) },
      { label: 'Chats', value: String(customer.value.chatCount) },
      { label: 'Rating', value: customer.value.rating ? `${customer.value.rating.toFixed(1)} / 5` : '—' },
    ]
  : [])
const when = (iso: string) => new Date(iso).toLocaleString(APP_LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const CHAT_STATUS: Record<string, string> = { ai: 'AI handling', waiting: 'Waiting', active: 'With an agent', closed: 'Ended' }
</script>

<template>
  <div v-if="notFound" class="py-20 text-center text-muted-foreground">
    No tickets or chats from {{ email }}.
    <NuxtLink to="/service/customers" class="font-semibold underline">
      Back to customers
    </NuxtLink>
  </div>

  <div v-else-if="customer" class="mx-auto flex w-full max-w-[1360px] flex-col gap-4">
    <PageActions label="Customer actions">
      <Button variant="ghost" size="icon" as-child aria-label="Back to customers">
        <NuxtLink to="/service/customers">
          <Icon name="i-lucide-arrow-left" />
        </NuxtLink>
      </Button>
      <Button variant="lime" :disabled="saving || !isDirty" @click="save">
        <Icon name="i-lucide-save" />
        Save
      </Button>
      <Button variant="ghost" as-child>
        <a :href="`mailto:${customer.email}`">
          <Icon name="i-lucide-mail" />
          Email
        </a>
      </Button>
      <Button v-if="customer.clientId && canOpenClients" variant="ghost" as-child>
        <NuxtLink :to="`/clients/${customer.clientId}`">
          <Icon name="i-lucide-building-2" />
          Open company
        </NuxtLink>
      </Button>
    </PageActions>

    <RecordHeader :eyebrow="`Customer · ${customer.clientName ?? 'Not matched to a client'}`" :title="customer.name" :subtitle="customer.email" :stats="stats" />

    <RecordTabs v-model="tab" :related="related" />

    <div v-if="tab === 'summary'" class="grid items-start gap-4 lg:grid-cols-2">
      <RecordCard title="Details">
        <div class="flex flex-col gap-1.5">
          <Label for="customer-name">Name</Label>
          <Input id="customer-name" v-model="form.name" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="customer-phone">Phone</Label>
          <Input id="customer-phone" v-model="form.phone" type="tel" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="customer-notes">Notes for the team</Label>
          <Textarea id="customer-notes" v-model="form.notes" rows="5" placeholder="Preferences, context, anything the next person should know" />
          <span v-if="customer.updatedBy" class="text-xs text-muted-foreground">Last edited by {{ customer.updatedBy }}</span>
        </div>
      </RecordCard>
      <RecordCard title="Recent activity">
        <ol class="m-0 flex list-none flex-col p-0">
          <li v-for="item in [...customer.tickets.map(t => ({ key: t.id, at: t.createdAt, label: `Case ${t.id}: ${t.subject}`, detail: t.status, to: `/tickets/${t.id}` })), ...customer.chats.map(c => ({ key: c.id, at: c.startedAt, label: `Chat ${c.id}${c.subject ? `: ${c.subject}` : ''}`, detail: CHAT_STATUS[c.status] ?? c.status, to: `/inbox?open=${c.id}` }))].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12)" :key="item.key" class="border-b border-border py-2.5 last:border-0">
            <NuxtLink :to="item.to" class="flex justify-between gap-3 hover:underline">
              <span class="line-clamp-1 text-sm font-semibold text-foreground">{{ item.label }}</span>
              <span class="shrink-0 text-xs text-muted-foreground">{{ when(item.at) }}</span>
            </NuxtLink>
            <div class="text-xs capitalize text-muted-foreground">
              {{ item.detail }}
            </div>
          </li>
        </ol>
      </RecordCard>
    </div>

    <div v-if="tab === 'details'" class="grid items-start gap-4 lg:grid-cols-2">
      <RecordCard title="Record information">
        <dl class="m-0 grid gap-3 text-sm">
          <div>
            <dt class="text-xs text-muted-foreground">
              Email
            </dt>
            <dd class="m-0 font-semibold text-foreground">
              {{ customer.email }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Company
            </dt>
            <dd class="m-0 text-foreground">
              {{ customer.clientName ?? 'Not matched — add this email to a client contact to link them' }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Last contact
            </dt>
            <dd class="m-0 text-foreground">
              {{ when(customer.lastContactAt) }}
            </dd>
          </div>
        </dl>
      </RecordCard>
    </div>

    <RecordCard v-if="tab === 'cases'" title="Cases">
      <div v-for="ticket in customer.tickets" :key="ticket.id" class="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2.5 last:border-0">
        <NuxtLink :to="`/tickets/${ticket.id}`" class="min-w-0 hover:underline">
          <span class="font-mono text-xs text-muted-foreground">{{ ticket.id }}</span>
          <span class="ml-2 font-semibold text-foreground">{{ ticket.subject }}</span>
        </NuxtLink>
        <span class="text-xs capitalize text-muted-foreground">{{ ticket.status }} · {{ ticket.priority }} · {{ when(ticket.createdAt) }}</span>
      </div>
      <p v-if="!customer.tickets.length" class="m-0 text-sm text-muted-foreground">
        No cases.
      </p>
    </RecordCard>

    <RecordCard v-if="tab === 'chats'" title="Chats">
      <div v-for="chat in customer.chats" :key="chat.id" class="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2.5 last:border-0">
        <NuxtLink :to="`/inbox?open=${chat.id}`" class="min-w-0 hover:underline">
          <span class="font-mono text-xs text-muted-foreground">{{ chat.id }}</span>
          <span class="ml-2 font-semibold text-foreground">{{ chat.subject ?? 'Chat' }}</span>
        </NuxtLink>
        <span class="text-xs text-muted-foreground">{{ CHAT_STATUS[chat.status] }}<template v-if="chat.aiAgentName"> · {{ chat.aiAgentName }} (AI)</template><template v-if="chat.assigneeName"> · {{ chat.assigneeName }}</template> · {{ when(chat.startedAt) }}</span>
      </div>
      <p v-if="!customer.chats.length" class="m-0 text-sm text-muted-foreground">
        No chats.
      </p>
    </RecordCard>

    <RecordCard v-if="tab === 'ratings'" title="Satisfaction ratings">
      <div v-for="survey in customer.surveys" :key="survey.ticketId + survey.respondedAt" class="border-b border-border py-2.5 last:border-0">
        <div class="flex justify-between gap-2">
          <span class="font-semibold text-foreground">{{ '★'.repeat(survey.rating) }}<span class="text-muted-foreground">{{ '★'.repeat(5 - survey.rating) }}</span> <span class="sr-only">{{ survey.rating }} out of 5</span></span>
          <NuxtLink :to="`/tickets/${survey.ticketId}`" class="text-xs text-muted-foreground hover:underline">
            {{ survey.ticketId }} · {{ when(survey.respondedAt) }}
          </NuxtLink>
        </div>
        <p v-if="survey.comment" class="m-0 mt-1 text-sm">
          “{{ survey.comment }}”
        </p>
      </div>
      <p v-if="!customer.surveys.length" class="m-0 text-sm text-muted-foreground">
        No ratings yet.
      </p>
    </RecordCard>
  </div>

  <div v-else class="py-20 text-center text-muted-foreground">
    Loading…
  </div>
</template>
