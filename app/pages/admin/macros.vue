<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { priorities, statuses } from '~/components/tickets/data/data'

definePageMeta({
  middleware: 'admin',
})

const { macros, fetchMacros, addMacro, removeMacro } = useMacros()

onMounted(() => {
  fetchMacros()
})

const isAddOpen = ref(false)

const macroFormSchema = toTypedSchema(z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  body: z.string().min(5, { message: 'Body must be at least 5 characters.' }),
  setStatus: z.enum(['open', 'in-progress', 'resolved', 'closed']).optional(),
  setPriority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: macroFormSchema,
  initialValues: { name: '', body: '', setStatus: undefined, setPriority: undefined },
})

const onSubmit = handleSubmit(async (values) => {
  try {
    await addMacro(values)
    resetForm()
    isAddOpen.value = false
    toast('Macro created', {
      description: `"${values.name}" is now available on tickets.`,
    })
  }
  catch (error: any) {
    toast('Could not create macro', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
})

async function onDelete(id: string, name: string) {
  await removeMacro(id)
  toast('Macro deleted', { description: `"${name}" was removed.` })
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Macros
        </h2>
        <p class="text-muted-foreground">
          Canned responses agents can apply from a ticket to reply and update fields in one step.
        </p>
      </div>

      <Dialog v-model:open="isAddOpen">
        <DialogTrigger as-child>
          <Button>
            <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
            New Macro
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Macro</DialogTitle>
            <DialogDescription>
              The body is sent as a public reply. Status/priority changes are optional.
            </DialogDescription>
          </DialogHeader>

          <form class="flex flex-col gap-4" @submit="onSubmit">
            <FormField v-slot="{ componentField }" name="name">
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="e.g. Ask for more info" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="body">
              <FormItem>
                <FormLabel>Reply body</FormLabel>
                <FormControl>
                  <Textarea rows="4" placeholder="Hi, thanks for reaching out..." v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <div class="grid grid-cols-2 gap-4">
              <FormField v-slot="{ componentField }" name="setStatus">
                <FormItem>
                  <FormLabel>Set status (optional)</FormLabel>
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
                  <FormLabel>Set priority (optional)</FormLabel>
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
            </div>

            <DialogFooter>
              <Button type="submit">
                Create Macro
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
            <TableHead>Body</TableHead>
            <TableHead>Sets</TableHead>
            <TableHead class="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="macros.length">
            <TableRow v-for="macro in macros" :key="macro.id">
              <TableCell class="font-medium">
                {{ macro.name }}
              </TableCell>
              <TableCell class="text-muted-foreground max-w-[360px] truncate">
                {{ macro.body }}
              </TableCell>
              <TableCell>
                <div class="flex gap-1">
                  <Badge v-if="macro.setStatus" variant="outline" class="capitalize">
                    {{ macro.setStatus }}
                  </Badge>
                  <Badge v-if="macro.setPriority" variant="outline" class="capitalize">
                    {{ macro.setPriority }}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <Button size="icon-sm" variant="ghost" class="text-destructive" @click="onDelete(macro.id, macro.name)">
                  <Icon name="i-lucide-trash-2" class="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="4" class="h-24 text-center">
              No macros yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
