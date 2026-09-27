<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/vue-3'

import OfficeIcon from './OfficeIcon.vue'
import { useNodeViewEditable } from '../composables/useNodeViewEditable'

const props = defineProps<NodeViewProps>()

const colorOptions = ['#f56565', '#ff8b00', '#ffc400', '#6bcf43', '#5b8cff', '#7c4dff', '#aab2bd']

const nowTimestamp = ref(Date.now())
const isColorPanelOpen = ref(false)
const isSettingsOpen = ref(false)
const editMode = ref<'duration' | 'deadline'>('duration')
const durationDays = ref('0')
const durationHours = ref('0')
const durationMinutes = ref('0')
const durationSeconds = ref('0')
const deadlineInput = ref('')
const isDatePickerOpen = ref(false)
const isTimePickerOpen = ref(false)
const calendarYear = ref(new Date().getFullYear())
const calendarMonth = ref(new Date().getMonth())
const reminderEnabled = ref(true)
const colorTriggerRef = ref<HTMLElement | null>(null)
const colorPanelRef = ref<HTMLElement | null>(null)
const dateTriggerRef = ref<HTMLElement | null>(null)
const datePanelRef = ref<HTMLElement | null>(null)
const timeTriggerRef = ref<HTMLElement | null>(null)
const timePanelRef = ref<HTMLElement | null>(null)
let timer: number | null = null

const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六']
const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const minuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))

const targetTimestamp = computed(() => Number(props.node.attrs.targetTimestamp ?? 0) || 0)
const blockColor = computed(() => String(props.node.attrs.color || '#ff8b00'))
const canEdit = useNodeViewEditable(props.editor)
const remainingMilliseconds = computed(() => {
  if (targetTimestamp.value <= 0) {
    return 0
  }

  return Math.max(0, targetTimestamp.value - nowTimestamp.value)
})

const units = computed(() => {
  const totalSeconds = Math.floor(remainingMilliseconds.value / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [
    { key: 'days', label: '天', value: String(days).padStart(2, '0') },
    { key: 'hours', label: '时', value: String(hours).padStart(2, '0') },
    { key: 'minutes', label: '分', value: String(minutes).padStart(2, '0') },
    { key: 'seconds', label: '秒', value: String(seconds).padStart(2, '0') },
  ]
})

const countdownStyle = computed(() => ({
  '--norio-office-rich-countdown-color': blockColor.value,
}))

const deadlineDate = computed(() => {
  const parsed = new Date(deadlineInput.value)
  return Number.isFinite(parsed.getTime()) ? parsed : new Date()
})

const deadlineDateLabel = computed(() => {
  const date = deadlineDate.value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})

const deadlineTimeLabel = computed(() => {
  const date = deadlineDate.value
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
})

const calendarTitle = computed(() => `${calendarYear.value}年 ${calendarMonth.value + 1}月`)

const calendarCells = computed(() => {
  const firstDay = new Date(calendarYear.value, calendarMonth.value, 1)
  const startWeekday = firstDay.getDay()
  const daysInMonth = new Date(calendarYear.value, calendarMonth.value + 1, 0).getDate()
  const daysInPrevMonth = new Date(calendarYear.value, calendarMonth.value, 0).getDate()
  const selected = deadlineDate.value
  const today = new Date()

  return Array.from({ length: 42 }, (_, index) => {
    let year = calendarYear.value
    let month = calendarMonth.value
    let day = index - startWeekday + 1
    let isCurrentMonth = true

    if (day <= 0) {
      month -= 1
      if (month < 0) {
        month = 11
        year -= 1
      }
      day = daysInPrevMonth + day
      isCurrentMonth = false
    } else if (day > daysInMonth) {
      day -= daysInMonth
      month += 1
      if (month > 11) {
        month = 0
        year += 1
      }
      isCurrentMonth = false
    }

    return {
      key: `${year}-${month}-${day}`,
      year,
      month,
      day,
      isCurrentMonth,
      isToday:
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === day,
      isSelected:
        selected.getFullYear() === year &&
        selected.getMonth() === month &&
        selected.getDate() === day,
    }
  })
})

function parseCountdownNumber(value: string, max?: number) {
  const parsed = Number.parseInt(value || '0', 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  return typeof max === 'number' ? Math.min(max, parsed) : parsed
}

function formatLocalDateTimeValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function syncCalendarFromDeadline() {
  const date = deadlineDate.value
  calendarYear.value = date.getFullYear()
  calendarMonth.value = date.getMonth()
}

function setDeadlineValue(date: Date) {
  deadlineInput.value = formatLocalDateTimeValue(date)
  syncCalendarFromDeadline()
}

function fillDurationFields(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  durationDays.value = String(days)
  durationHours.value = String(hours)
  durationMinutes.value = String(minutes)
  durationSeconds.value = String(seconds)
}

function openSettings() {
  if (!canEdit.value) {
    return
  }

  const mode = props.node.attrs.mode === 'deadline' ? 'deadline' : 'duration'
  const target = targetTimestamp.value > 0 ? targetTimestamp.value : Date.now() + 60_000

  editMode.value = mode
  fillDurationFields(Math.max(0, targetTimestamp.value - Date.now()))
  setDeadlineValue(new Date(target))
  reminderEnabled.value = props.node.attrs.reminderEnabled !== false
  isColorPanelOpen.value = false
  isDatePickerOpen.value = false
  isTimePickerOpen.value = false
  isSettingsOpen.value = true
}

function closeSettings() {
  isSettingsOpen.value = false
  isDatePickerOpen.value = false
  isTimePickerOpen.value = false
}

function confirmSettings() {
  let nextTargetTimestamp = 0

  if (editMode.value === 'deadline') {
    const parsed = new Date(deadlineInput.value).getTime()
    nextTargetTimestamp = Number.isFinite(parsed) ? parsed : 0
  } else {
    const days = parseCountdownNumber(durationDays.value)
    const hours = parseCountdownNumber(durationHours.value, 23)
    const minutes = parseCountdownNumber(durationMinutes.value, 59)
    const seconds = parseCountdownNumber(durationSeconds.value, 59)
    const totalSeconds = ((days * 24 + hours) * 60 + minutes) * 60 + seconds
    nextTargetTimestamp = totalSeconds > 0 ? Date.now() + totalSeconds * 1000 : 0
  }

  props.updateAttributes({
    targetTimestamp: Math.floor(nextTargetTimestamp),
    mode: editMode.value,
    reminderEnabled: reminderEnabled.value,
  })
  closeSettings()
}

function toggleColorPanel() {
  if (!canEdit.value) {
    return
  }

  isColorPanelOpen.value = !isColorPanelOpen.value
  if (isColorPanelOpen.value) {
    isSettingsOpen.value = false
    isDatePickerOpen.value = false
    isTimePickerOpen.value = false
  }
}

function applyColor(color: string) {
  if (!canEdit.value) {
    return
  }

  props.updateAttributes({ color })
  isColorPanelOpen.value = false
}

function toggleDatePicker() {
  editMode.value = 'deadline'
  isDatePickerOpen.value = !isDatePickerOpen.value
  isTimePickerOpen.value = false
  syncCalendarFromDeadline()
}

function toggleTimePicker() {
  editMode.value = 'deadline'
  isTimePickerOpen.value = !isTimePickerOpen.value
  isDatePickerOpen.value = false
}

function moveCalendarMonth(offset: number) {
  const next = new Date(calendarYear.value, calendarMonth.value + offset, 1)
  calendarYear.value = next.getFullYear()
  calendarMonth.value = next.getMonth()
}

function selectCalendarDate(year: number, month: number, day: number) {
  const current = deadlineDate.value
  const next = new Date(current)
  next.setFullYear(year, month, day)
  setDeadlineValue(next)
  isDatePickerOpen.value = false
}

function selectToday() {
  const current = deadlineDate.value
  const today = new Date()
  today.setHours(current.getHours(), current.getMinutes(), 0, 0)
  setDeadlineValue(today)
  isDatePickerOpen.value = false
}

function selectDeadlineHour(hour: string) {
  const next = new Date(deadlineDate.value)
  next.setHours(parseCountdownNumber(hour, 23), next.getMinutes(), 0, 0)
  setDeadlineValue(next)
}

function selectDeadlineMinute(minute: string) {
  const next = new Date(deadlineDate.value)
  next.setHours(next.getHours(), parseCountdownNumber(minute, 59), 0, 0)
  setDeadlineValue(next)
  isTimePickerOpen.value = false
}

function handleDocumentPointerDown(event: MouseEvent) {
  const target = event.target as Node | null
  if (!target) {
    return
  }

  if (
    colorTriggerRef.value?.contains(target) ||
    colorPanelRef.value?.contains(target) ||
    dateTriggerRef.value?.contains(target) ||
    datePanelRef.value?.contains(target) ||
    timeTriggerRef.value?.contains(target) ||
    timePanelRef.value?.contains(target)
  ) {
    return
  }

  isColorPanelOpen.value = false
  isDatePickerOpen.value = false
  isTimePickerOpen.value = false
}

function startTimer() {
  stopTimer()
  nowTimestamp.value = Date.now()
  timer = window.setInterval(() => {
    nowTimestamp.value = Date.now()
  }, 1000)
}

function stopTimer() {
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
}

onMounted(() => {
  startTimer()
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  stopTimer()
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<template>
  <NodeViewWrapper class="norio-office-rich-countdown-block" :class="{ 'norio-office-rich-countdown-block--selected': selected && canEdit }" :style="countdownStyle">
    <div class="norio-office-rich-countdown-block__inner">
      <div v-if="canEdit" class="norio-office-rich-countdown-block__actions">
        <button
          type="button"
          class="norio-office-rich-countdown-block__tool"
          title="编辑"
          aria-label="编辑"
          @mousedown.prevent.stop
          @click.stop="openSettings"
        >
          <OfficeIcon name="edit" :size="16" color="#5f6b7a" background-color="transparent" />
        </button>

        <div class="norio-office-rich-countdown-block__color-control">
          <button
            ref="colorTriggerRef"
            type="button"
            class="norio-office-rich-countdown-block__tool"
            :class="{ 'norio-office-rich-countdown-block__tool--active': isColorPanelOpen }"
            title="设置颜色"
            aria-label="设置颜色"
            @mousedown.prevent.stop
            @click.stop="toggleColorPanel"
          >
            <OfficeIcon name="yanse" :size="16" color="#5f6b7a" background-color="transparent" />
          </button>

          <div
            v-if="isColorPanelOpen"
            ref="colorPanelRef"
            class="norio-office-rich-countdown-color-panel"
            @mousedown.stop
            @click.stop
          >
            <div class="norio-office-rich-countdown-color-panel__title">颜色</div>
            <div class="norio-office-rich-countdown-color-panel__swatches">
              <button
                v-for="color in colorOptions"
                :key="color"
                type="button"
                class="norio-office-rich-countdown-color-panel__swatch"
                :class="{ 'norio-office-rich-countdown-color-panel__swatch--active': color === blockColor }"
                :style="{ backgroundColor: color }"
                @click="applyColor(color)"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="norio-office-rich-countdown-block__digits">
        <template v-for="(unit, index) in units" :key="unit.key">
          <div class="norio-office-rich-countdown-block__unit">
            <span class="norio-office-rich-countdown-block__card">{{ unit.value }}</span>
            <span class="norio-office-rich-countdown-block__label">{{ unit.label }}</span>
          </div>
          <span v-if="index < units.length - 1" class="norio-office-rich-countdown-block__separator">:</span>
        </template>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="isSettingsOpen && canEdit" class="norio-office-rich-countdown-dialog" @mousedown.stop>
        <div class="norio-office-rich-countdown-dialog__panel">
          <div class="norio-office-rich-countdown-dialog__header">
            <div class="norio-office-rich-countdown-dialog__title">倒计时设置</div>
            <button type="button" class="norio-office-rich-countdown-dialog__close" @click="closeSettings">
              <OfficeIcon name="close" :size="20" color="#6b7280" background-color="transparent" />
            </button>
          </div>

          <label class="norio-office-rich-countdown-dialog__option" :class="{ 'norio-office-rich-countdown-dialog__option--active': editMode === 'duration' }">
            <span class="norio-office-rich-countdown-dialog__radio">
              <input v-model="editMode" type="radio" value="duration" />
              <span />
            </span>
            <span class="norio-office-rich-countdown-dialog__option-title">输入倒计时时长</span>
            <span class="norio-office-rich-countdown-dialog__duration">
              <input v-model="durationDays" type="number" min="0" />
              <span>天</span>
              <input v-model="durationHours" type="number" min="0" max="23" />
              <span>时</span>
              <input v-model="durationMinutes" type="number" min="0" max="59" />
              <span>分</span>
              <input v-model="durationSeconds" type="number" min="0" max="59" />
              <span>秒</span>
            </span>
          </label>

          <label class="norio-office-rich-countdown-dialog__option" :class="{ 'norio-office-rich-countdown-dialog__option--active': editMode === 'deadline' }">
            <span class="norio-office-rich-countdown-dialog__radio">
              <input v-model="editMode" type="radio" value="deadline" />
              <span />
            </span>
            <span class="norio-office-rich-countdown-dialog__option-title">选择具体日期</span>
            <span class="norio-office-rich-countdown-dialog__date-picker">
              <button
                ref="dateTriggerRef"
                type="button"
                class="norio-office-rich-countdown-dialog__date-button"
                :disabled="editMode !== 'deadline'"
                @click.prevent="toggleDatePicker"
              >
                <span>{{ deadlineDateLabel }}</span>
              </button>
              <button
                ref="timeTriggerRef"
                type="button"
                class="norio-office-rich-countdown-dialog__time-button"
                :disabled="editMode !== 'deadline'"
                @click.prevent="toggleTimePicker"
              >
                <span>{{ deadlineTimeLabel }}</span>
              </button>
              <OfficeIcon name="days" :size="16" color="#8a95a5" background-color="transparent" />

              <div v-if="isDatePickerOpen" ref="datePanelRef" class="norio-office-rich-countdown-date-picker" @click.stop>
                <div class="norio-office-rich-countdown-date-picker__header">
                  <button type="button" class="norio-office-rich-countdown-date-picker__nav" @click="moveCalendarMonth(-1)">
                    <OfficeIcon name="zuojiantou" :size="14" color="#4b5563" background-color="transparent" />
                  </button>
                  <div class="norio-office-rich-countdown-date-picker__title">{{ calendarTitle }}</div>
                  <button type="button" class="norio-office-rich-countdown-date-picker__nav" @click="moveCalendarMonth(1)">
                    <OfficeIcon name="youjiantou" :size="14" color="#4b5563" background-color="transparent" />
                  </button>
                </div>

                <div class="norio-office-rich-countdown-date-picker__weekdays">
                  <span v-for="weekday in weekdayLabels" :key="weekday">{{ weekday }}</span>
                </div>

                <div class="norio-office-rich-countdown-date-picker__grid">
                  <button
                    v-for="cell in calendarCells"
                    :key="cell.key"
                    type="button"
                    class="norio-office-rich-countdown-date-picker__day"
                    :class="{
                      'norio-office-rich-countdown-date-picker__day--muted': !cell.isCurrentMonth,
                      'norio-office-rich-countdown-date-picker__day--today': cell.isToday,
                      'norio-office-rich-countdown-date-picker__day--selected': cell.isSelected,
                    }"
                    @click="selectCalendarDate(cell.year, cell.month, cell.day)"
                  >
                    {{ cell.day }}
                  </button>
                </div>

                <button type="button" class="norio-office-rich-countdown-date-picker__today" @click="selectToday">
                  今天
                </button>
              </div>

              <div v-if="isTimePickerOpen" ref="timePanelRef" class="norio-office-rich-countdown-time-picker" @click.stop>
                <div class="norio-office-rich-countdown-time-picker__column">
                  <button
                    v-for="hour in hourOptions"
                    :key="`hour-${hour}`"
                    type="button"
                    class="norio-office-rich-countdown-time-picker__item"
                    :class="{ 'norio-office-rich-countdown-time-picker__item--active': hour === deadlineTimeLabel.slice(0, 2) }"
                    @click="selectDeadlineHour(hour)"
                  >
                    {{ hour }}
                  </button>
                </div>
                <div class="norio-office-rich-countdown-time-picker__column">
                  <button
                    v-for="minute in minuteOptions"
                    :key="`minute-${minute}`"
                    type="button"
                    class="norio-office-rich-countdown-time-picker__item"
                    :class="{ 'norio-office-rich-countdown-time-picker__item--active': minute === deadlineTimeLabel.slice(3, 5) }"
                    @click="selectDeadlineMinute(minute)"
                  >
                    {{ minute }}
                  </button>
                </div>
              </div>
            </span>
          </label>

          <div class="norio-office-rich-countdown-dialog__footer">
            <label class="norio-office-rich-countdown-dialog__checkbox">
              <input v-model="reminderEnabled" type="checkbox" />
              <span>倒计时结束时显示气泡提醒</span>
            </label>

            <div class="norio-office-rich-countdown-dialog__actions">
              <button type="button" class="norio-office-rich-countdown-dialog__button norio-office-rich-countdown-dialog__button--secondary" @click="closeSettings">
                取消
              </button>
              <button type="button" class="norio-office-rich-countdown-dialog__button norio-office-rich-countdown-dialog__button--primary" @click="confirmSettings">
                确定
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </NodeViewWrapper>
</template>
