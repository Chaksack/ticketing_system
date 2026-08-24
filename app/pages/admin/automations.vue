<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { priorities, statuses } from '~/components/tickets/data/data'

definePageMeta({
  middleware: 'admin',
})

const { rules, fetchRules, addRule, setRuleEnabled, removeRule } = useAutomationRules()
const { staff, fetchStaff } = useStaff()

onMounted(() => {
  fetchRules()
  fetchStaff()
})

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))

const isAddOpen = ref(false)

const ruleFormSchema = toTypedSchema(z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  field: z.enum(['category', 'subject'], { required_error: 'Please select a field.' }),
  operator: z.enum(['equals', 'contains'], { required_error: 'Please select an operator.' }),
  value: z.string().min(1, { message: 'Value is required.' }),
  setStatus: z.enum(['open', 'in-progress', 'resolved', 'closed']).optional(),
  setPriority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  setAssigneeId: z.string().optional(),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: ruleFormSchema,
  initialValues: { name: '', field: 'category', operator: 'equals', value: '', setStatus: undefined, setPriority: undefined, setAssigneeId: undefined },
})

const onSubmit = handleSubmit(async (values) => {
  try {
    await addRule({ ...values, setAssigneeId: values.setAssigneeId || undefined })
    resetForm()
    isAddOpen.value = false
    toast('Automation rule created', {
      description: `"${values.name}" will apply to new tickets.`,
    })
  }
  catch (error: any) {
    toast('Could not create rule', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
})

async function onToggle(id: string, enabled: boolean) {
  await setRuleEnabled(id, enabled)
}

async function onDelete(id: string, name: string) {
  await removeRule(id)
  toast('Rule deleted', { description: `"${name}" was removed.` })
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Automations
        </h2>
        <p class="text-muted-foreground">
          Rules run once when a ticket is created. The first matching rule applies.
        </p>
      </div>

      <Dialog v-model:open="isAddOpen">
        <DialogTrigger as-child>
          <Button>
            <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
            New Rule
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Automation Rule</DialogTitle>
            <DialogDescription>
              If the condition matches a new ticket, the selected fields are applied.
            </DialogDescription>
          </DialogHeader>

          <form class="flex flex-col gap-4" @submit="onSubmit">
            <FormField v-slot="{ componentField }" name="name">
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="e.g. Route billing issues" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <div class="grid grid-cols-3 gap-2 items-end">
              <FormField v-slot="{ componentField }" name="field">
                <FormItem>
                  <FormLabel>When</FormLabel>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="category">
                        Category
                      </SelectItem>
                      <SelectItem value="subject">
                        Subject
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="operator">
                <FormItem>
                  <FormLabel>Operator</FormLabel>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="equals">
                        Equals
                      </SelectItem>
                      <SelectItem value="contains">
                        Contains
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="value">
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="Billing" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <FormField v-slot="{ componentField }" name="setStatus">
                <FormItem>
                  <FormLabel>Set status</FormLabel>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="No change" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem v-for="option in statuses" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="setPriority">
                <FormItem>
                  <FormLabel>Set priority</FormLabel>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="No change" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem v-for="option in priorities" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="setAssigneeId">
                <FormItem>
                  <FormLabel>Assign to</FormLabel>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="No change" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem v-for="member in activeStaff" :key="member.id" :value="member.id">
                        {{ member.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <DialogFooter>
              <Button type="submit">
                Create Rule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Condition</TableHead>
            <TableHead>Actions</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead class="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="rules.length">
            <TableRow v-for="rule in rules" :key="rule.id">
              <TableCell class="font-medium">
                {{ rule.name }}
              </TableCell>
              <TableCell class="text-muted-foreground text-sm">
                {{ rule.field }} {{ rule.operator }} "{{ rule.value }}"
              </TableCell>
              <TableCell>
                <div class="flex gap-1">
                  <Badge v-if="rule.setStatus" variant="outline" class="capitalize">
                    {{ rule.setStatus }}
                  </Badge>
                  <Badge v-if="rule.setPriority" variant="outline" class="capitalize">
                    {{ rule.setPriority }}
                  </Badge>
                  <Badge v-if="rule.setAssigneeId" variant="outline">
                    {{ activeStaff.find(s => s.id === rule.setAssigneeId)?.name ?? 'Assignee' }}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <Switch :model-value="rule.enabled" @update:model-value="(v) => onToggle(rule.id, !!v)" />
              </TableCell>
              <TableCell>
                <Button size="icon-sm" variant="ghost" class="text-destructive" @click="onDelete(rule.id, rule.name)">
                  <Icon name="i-lucide-trash-2" class="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="5" class="h-24 text-center">
              No automation rules yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
