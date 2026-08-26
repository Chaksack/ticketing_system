import type { DateValue } from '@internationalized/date'
import {
  CalendarDateTime,
  getLocalTimeZone,
  parseAbsoluteToLocal,
} from '@internationalized/date'

export function useDateTimeField() {
  const date = ref<DateValue>()
  const time = ref('00:00')

  watch(time, (newVal) => {
    if (!newVal || !date.value)
      return
    const [hours, minutes] = newVal.split(':').map(Number)
    date.value = new CalendarDateTime(date.value.year, date.value.month, date.value.day, hours, minutes)
  })

  function setFromIso(iso?: string) {
    if (!iso) {
      date.value = undefined
      time.value = '00:00'
      return
    }
    const parsed = parseAbsoluteToLocal(iso)
    date.value = parsed
    time.value = `${parsed.hour < 10 ? `0${parsed.hour}` : parsed.hour}:${parsed.minute < 10 ? `0${parsed.minute}` : parsed.minute}`
  }

  function toIso() {
    return date.value?.toDate(getLocalTimeZone()).toISOString()
  }

  function reset() {
    date.value = undefined
    time.value = '00:00'
  }

  return { date, time, setFromIso, toIso, reset }
}
