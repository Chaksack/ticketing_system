<script setup lang="ts">
import type { BdEntityType, BdRuleTrigger } from '~/types/automation'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { leadStages } from '~/components/leads/data'
import { tenderStages } from '~/components/tenders/data'

definePageMeta({
  middleware: 'admin',
})

const { rules, fetchRules, addRule, setRuleEnabled, removeRule } = useBdAutomationRules()
const { staff, fetchStaff } = useStaff()

onMounted(() => {
  fetchRules()
  fetchStaff()
})

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))

function staffName(id?: string) {
  return activeStaff.value.find(s => s.id === id)?.name ?? 'Staff'
}

function stageOptions(entityType: BdEntityType) {
  return entityType === 'lead' ? leadStages : tenderStages
}

function stageLabel(entityType: string, stage?: string) {
  if (!stage)
    return ''
  return stageOptions(entityType as BdEntityType).find(s => s.value === stage)?.label ?? stage
}

const searchQuery = ref('')
const filteredRules = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query)
    return rules.value
  return rules.value.filter(r => r.name.toLowerCase().includes(query))
})

const isAddOpen = ref(false)

const ruleFormSchema = toTypedSchema(z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  entityType: z.enum(['lead', 'tender'], { required_error: 'Please select an entity type.' }),
  trigger: z.enum(['created', 'stage_changed'], { required_error: 'Please select a trigger.' }),
  value: z.string().optional(),
  toStage: z.string().optional(),
  setAssigneeId: z.string().optional(),
  notifyStaffId: z.string().optional(),
}))

const { handleSubmit, resetForm, values } = useForm({
  validationSchema: ruleFormSchema,
  initialValues: { name: '', entityType: 'lead', trigger: 'created', value: '', toStage: undefined, setAssigneeId: undefined, notifyStaffId: undefined },
})

const onSubmit = handleSubmit(async (formValues) => {
  try {
    await addRule({
      name: formValues.name,
      entityType: formValues.entityType as BdEntityType,
      trigger: formValues.trigger as BdRuleTrigger,
      field: formValues.trigger === 'created' ? 'source' : undefined,
      operator: formValues.trigger === 'created' ? 'contains' : undefined,
      value: formValues.trigger === 'created' ? formValues.value : undefined,
      toStage: formValues.trigger === 'stage_changed' ? formValues.toStage : undefined,
      setAssigneeId: formValues.setAssigneeId || undefined,
      notifyStaffId: formValues.notifyStaffId || undefined,
    })
    resetForm()
    isAddOpen.value = false
    toast('Automation rule created', {
      description: `"${formValues.name}" will apply to ${formValues.entityType}s.`,
    })
  }
  catch (error: any) {
    toast.error('Could not create rule', {
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
          BD Automations
        </h2>
        <p class="text-muted-foreground">
          Auto-assign new leads/tenders by source, or notify someone when one reaches a stage.
        </p>
      </div>

      <Sheet v-model:open="isAddOpen">
        <SheetTrigger as-child>
          <Button>
            <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
            New Rule
          </Button>
        </SheetTrigger>
        <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto p-6">
          <SheetHeader class="p-0">
            <SheetTitle>New BD Automation Rule</SheetTitle>
            <SheetDescription>
              Trigger on creation (matched by source) or when a record enters a stage.
            </SheetDescription>
          </SheetHeader>

          <form class="flex flex-col gap-4" @submit="onSubmit">
            <FormField v-slot="{ componentField }" name="name">
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="e.g. Route referral leads" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <div class="grid grid-cols-2 gap-2">
              <FormField v-slot="{ componentField }" name="entityType">
                <FormItem>
                  <FormLabel>Applies to</FormLabel>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="lead">
                        Leads
                      </SelectItem>
                      <SelectItem value="tender">
                        Tenders
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="trigger">
                <FormItem>
                  <FormLabel>Trigger</FormLabel>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="created">
                        On create (by source)
                      </SelectItem>
                      <SelectItem value="stage_changed">
                        On stage change
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <FormField v-if="values.trigger === 'created'" v-slot="{ componentField }" name="value">
              <FormItem>
                <FormLabel>Source contains</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="e.g. Referral" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-else v-slot="{ componentField }" name="toStage">
              <FormItem>
                <FormLabel>When stage becomes</FormLabel>
                <Select v-bind="componentField">
                  <FormControl>
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="Select a stage" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem v-for="option in stageOptions(values.entityType as BdEntityType)" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            </FormField>

            <div class="grid grid-cols-2 gap-2">
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

              <FormField v-slot="{ componentField }" name="notifyStaffId">
                <FormItem>
                  <FormLabel>Notify</FormLabel>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="No one" />
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

            <SheetFooter class="p-0">
              <Button type="submit">
                Create Rule
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>

    <div class="relative max-w-sm">
      <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input v-model="searchQuery" placeholder="Search automations..." class="pl-8" />
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Applies to</TableHead>
            <TableHead>Condition</TableHead>
            <TableHead>Actions</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead class="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="filteredRules.length">
            <TableRow v-for="rule in filteredRules" :key="rule.id">
              <TableCell class="font-medium">
                {{ rule.name }}
              </TableCell>
              <TableCell class="text-muted-foreground text-sm capitalize">
                {{ rule.entityType }}s
              </TableCell>
              <TableCell class="text-muted-foreground text-sm">
                <span v-if="rule.trigger === 'created'">source {{ rule.operator }} "{{ rule.value }}"</span>
                <span v-else>enters {{ stageLabel(rule.entityType, rule.toStage) }}</span>
              </TableCell>
              <TableCell>
                <div class="flex gap-1">
                  <Badge v-if="rule.setAssigneeId" variant="outline">
                    Assign: {{ staffName(rule.setAssigneeId) }}
                  </Badge>
                  <Badge v-if="rule.notifyStaffId" variant="outline">
                    Notify: {{ staffName(rule.notifyStaffId) }}
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
            <TableCell :colspan="6" class="h-24 text-center">
              No BD automation rules match your search.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
