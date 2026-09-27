<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import type { Editor } from '@tiptap/core'
import { NodeSelection, TextSelection, type EditorState } from '@tiptap/pm/state'
import { CellSelection } from '@tiptap/pm/tables'
import type { EditorView } from '@tiptap/pm/view'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import ColorPalettePanel from './ColorPalettePanel.vue'
import OfficeIcon from './OfficeIcon.vue'
import OfficeColorIcon from './OfficeColorIcon.vue'

export type TextSelectionAction = {
  key: string
  label: string
  icon?: string
  text?: string
  active?: boolean
  disabled?: boolean
  run?: () => void
  options?: TextSelectionAction[]
  color?: string
  defaultColor?: string
  recentColors?: string[]
  setColor?: (color: string) => void
  divider?: boolean
  fontFamily?: string
}
const props = defineProps<{
  editor: Editor
  actions: TextSelectionAction[]
  enabled: boolean
  scope?: 'text' | 'table'
  getReferencedVirtualElement?: () => { getBoundingClientRect: () => DOMRect; contextElement?: Element } | null
}>()
const pluginKey = props.scope === 'table' ? 'tableBubbleMenu' : 'textSelectionBubbleMenu'
const emit = defineEmits<{ 'visibility-change': [visible: boolean] }>()
const menuRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const nestedPanelRef = ref<HTMLElement | null>(null)
const nestedTriggerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const activeKey = ref<string | null>(null)
const nestedKey = ref<string | null>(null)
const dismissed = ref(false)
const isPointerSelecting = ref(false)
const isKeyboardSelecting = ref(false)
const isBubbleShown = ref(false)
const isSelecting = computed(() => isPointerSelecting.value || isKeyboardSelecting.value)
const isBubbleVisible = computed(() => props.enabled && !dismissed.value && !isSelecting.value && isBubbleShown.value)
const panelStyle = ref<CSSProperties>({})
const nestedPanelStyle = ref<CSSProperties>({})
const activeAction = computed(() => props.actions.find(action => action.key === activeKey.value))
const nestedAction = computed(() => activeAction.value?.options?.find(option => option.key === nestedKey.value))
let observer: ResizeObserver | null = null
let nestedObserver: ResizeObserver | null = null
let menuObserver: ResizeObserver | null = null
let selection = props.editor.state.selection

function repositionPanel() {
  const anchor = triggerRef.value?.getBoundingClientRect()
  const panel = panelRef.value
  if (!anchor || !panel) return
  const width = Math.min(activeAction.value?.setColor ? 264 : 232, window.innerWidth - 16)
  const height = Math.min(panel.scrollHeight, window.innerHeight - 16)
  const top = anchor.bottom + 8 + height <= window.innerHeight - 8 ? anchor.bottom + 8 : Math.max(8, anchor.top - height - 8)
  panelStyle.value = { position: 'fixed', width: `${width}px`, left: `${Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8))}px`, top: `${top}px`, maxHeight: `${window.innerHeight - 16}px` }
  repositionNestedPanel()
}

function repositionNestedPanel() {
  const anchor = nestedTriggerRef.value?.getBoundingClientRect()
  const panel = nestedPanelRef.value
  if (!anchor || !panel) return
  const width = Math.min(184, window.innerWidth - 16)
  const height = Math.min(panel.scrollHeight, window.innerHeight - 16)
  const fitsRight = anchor.right + 4 + width <= window.innerWidth - 8
  const fitsLeft = anchor.left - width - 4 >= 8
  const left = fitsRight ? anchor.right + 4
    : fitsLeft ? anchor.left - width - 4
      : Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8))
  const preferredTop = fitsRight || fitsLeft ? anchor.top
    : anchor.bottom + 4 + height <= window.innerHeight - 8 ? anchor.bottom + 4 : anchor.top - height - 4
  const top = Math.max(8, Math.min(preferredTop, window.innerHeight - height - 8))
  nestedPanelStyle.value = { position: 'fixed', width: `${width}px`, left: `${left}px`, top: `${top}px`, maxHeight: `${window.innerHeight - 16}px` }
}

function syncViewport() {
  if (!props.editor.isDestroyed && !props.editor.state.selection.empty && !dismissed.value && menuRef.value?.isConnected) {
    props.editor.view.dispatch(props.editor.state.tr.setMeta(pluginKey, 'updatePosition'))
  }
  repositionPanel()
}

function shouldShow({ view, state, element }: { view: EditorView; state: EditorState; element: HTMLElement }) {
  if (!state.selection.eq(selection)) dismissed.value = false
  const { $from, $to } = state.selection
  const isTableSelection = state.selection instanceof CellSelection
    || (state.selection instanceof NodeSelection && state.selection.node.type.name === 'table')
    || (state.selection instanceof TextSelection && Array.from({ length: $from.depth }, (_, index) => index + 1).some(depth =>
      $from.node(depth).type.name === 'table' && $to.depth >= depth && $from.start(depth) === $to.start(depth)))
  const hasTextSelection = state.selection instanceof TextSelection && !state.selection.empty
    && !!state.doc.textBetween(state.selection.from, state.selection.to).length
  const matchesScope = props.scope === 'table' ? isTableSelection && !state.selection.empty : hasTextSelection && !isTableSelection
  return props.enabled && !dismissed.value && props.editor.isEditable && matchesScope
    && (view.hasFocus() || element.contains(document.activeElement))
}

function toggleAction(action: TextSelectionAction, event: MouseEvent) {
  if (action.disabled) return
  if (action.options || action.setColor) {
    triggerRef.value = event.currentTarget as HTMLElement
    activeKey.value = activeKey.value === action.key ? null : action.key
  } else {
    activeKey.value = null
    action.run?.()
  }
}

function applyOption(option: TextSelectionAction) {
  if (option.disabled) return
  option.run?.()
  if (activeKey.value !== 'alignment') activeKey.value = null
}

function openNestedOption(option: TextSelectionAction, event: MouseEvent) {
  nestedKey.value = !option.disabled && option.options ? option.key : null
  nestedTriggerRef.value = nestedKey.value ? event.currentTarget as HTMLElement : null
}

function selectOption(option: TextSelectionAction, event: MouseEvent) {
  if (option.options) openNestedOption(option, event)
  else applyOption(option)
}

function handleSelectionUpdate() {
  const next = props.editor.state.selection
  if (!next.eq(selection)) {
    dismissed.value = false
    activeKey.value = null
  }
  selection = next
}

function handlePointerDown(event: PointerEvent) {
  if (event.target instanceof Node && !menuRef.value?.contains(event.target)) {
    activeKey.value = null
    dismissed.value = true
    if (event.button === 0 && props.editor.view.dom.contains(event.target)) isPointerSelecting.value = true
  }
}

function handlePointerUp() {
  isPointerSelecting.value = false
}

function handleKeyUp(event: KeyboardEvent) {
  if (!event.shiftKey || event.key === 'Shift') isKeyboardSelecting.value = false
}

function finishSelection() {
  isPointerSelecting.value = false
  isKeyboardSelecting.value = false
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.target instanceof Node && props.editor.view.dom.contains(event.target)
    && ((event.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key))
      || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a'))) {
    isKeyboardSelecting.value = true
  }
  if (event.key !== 'Escape' || !isBubbleVisible.value || !menuRef.value?.isConnected) return
  event.preventDefault()
  if (nestedKey.value) nestedKey.value = null
  else if (activeKey.value) activeKey.value = null
  else dismissed.value = true
  props.editor.commands.focus()
}

watch(panelRef, (panel) => {
  observer?.disconnect()
  observer = null
  if (!panel) return
  repositionPanel()
  observer = new ResizeObserver(repositionPanel)
  observer.observe(panel)
}, { flush: 'post' })
watch(menuRef, (menu) => {
  menuObserver?.disconnect()
  menuObserver = null
  if (!menu) return
  menuObserver = new ResizeObserver(syncViewport)
  menuObserver.observe(menu)
}, { flush: 'post' })
watch(nestedPanelRef, (panel) => {
  nestedObserver?.disconnect()
  nestedObserver = null
  if (!panel) return
  repositionNestedPanel()
  nestedObserver = new ResizeObserver(repositionNestedPanel)
  nestedObserver.observe(panel)
}, { flush: 'post' })
watch(nestedKey, () => void nextTick(repositionNestedPanel))
watch(activeKey, () => {
  nestedKey.value = null
  void nextTick(repositionPanel)
})
watch(() => props.enabled, (enabled) => {
  activeKey.value = null
  dismissed.value = !enabled
})
watch(isBubbleVisible, (visible) => emit('visibility-change', visible), { flush: 'sync' })
watch(isSelecting, (selecting) => {
  if (!selecting) void nextTick(syncViewport)
})

onMounted(() => {
  props.editor.on('selectionUpdate', handleSelectionUpdate)
  document.addEventListener('pointerdown', handlePointerDown, true)
  document.addEventListener('pointerup', handlePointerUp, true)
  document.addEventListener('pointercancel', handlePointerUp, true)
  document.addEventListener('keydown', handleKeyDown, true)
  document.addEventListener('keyup', handleKeyUp, true)
  window.addEventListener('blur', finishSelection)
  window.addEventListener('resize', syncViewport)
  window.addEventListener('scroll', syncViewport, true)
})
onBeforeUnmount(() => {
  emit('visibility-change', false)
  observer?.disconnect()
  nestedObserver?.disconnect()
  menuObserver?.disconnect()
  props.editor.off('selectionUpdate', handleSelectionUpdate)
  document.removeEventListener('pointerdown', handlePointerDown, true)
  document.removeEventListener('pointerup', handlePointerUp, true)
  document.removeEventListener('pointercancel', handlePointerUp, true)
  document.removeEventListener('keydown', handleKeyDown, true)
  document.removeEventListener('keyup', handleKeyUp, true)
  window.removeEventListener('blur', finishSelection)
  window.removeEventListener('resize', syncViewport)
  window.removeEventListener('scroll', syncViewport, true)
})

const appendTo = () => document.body
const bubbleOptions = {
  strategy: 'fixed' as const, placement: 'top' as const, offset: 8,
  flip: { padding: 8 }, shift: { padding: 8, crossAxis: true },
  onShow: () => { isBubbleShown.value = true },
  onHide: () => { activeKey.value = null; isBubbleShown.value = false },
  onUpdate: repositionPanel,
}
</script>

<template>
  <BubbleMenu
    v-show="enabled && !dismissed && !isSelecting"
    :class="scope === 'table' ? 'norio-office-rich-table-bubble-menu' : 'norio-office-rich-text-bubble'" :plugin-key="pluginKey"
    :editor="editor" :should-show="shouldShow" :append-to="appendTo" :options="bubbleOptions" :update-delay="0"
    :get-referenced-virtual-element="getReferencedVirtualElement"
  >
    <div ref="menuRef" class="norio-office-rich-text-bubble__content">
      <div class="norio-office-rich-text-bubble__toolbar" role="toolbar" aria-label="文字格式">
        <button
          v-for="action in actions" :key="action.key" type="button"
          class="norio-office-rich-text-bubble__button"
          :class="{ 'norio-office-rich-text-bubble__button--active': action.active || activeKey === action.key, 'norio-office-rich-text-bubble__button--select': action.options || action.setColor }"
          :disabled="action.disabled" :title="action.label" :aria-label="action.label"
          :aria-pressed="action.options || action.setColor ? undefined : !!action.active"
          :aria-expanded="action.options || action.setColor ? activeKey === action.key : undefined"
          @mousedown.prevent @click="toggleAction(action, $event)"
        >
          <span v-if="action.setColor" class="norio-office-rich-toolbar__color-trigger">
            <OfficeIcon v-if="action.icon" :name="action.icon" :size="16" color="currentColor" background-color="transparent" />
            <span v-else>A</span>
            <span class="norio-office-rich-toolbar__color-line" :style="{ backgroundColor: action.color }" />
          </span>
          <OfficeIcon v-else-if="action.icon" :name="action.icon" :size="16" color="currentColor" background-color="transparent" />
          <span v-else :class="{ 'norio-office-rich-toolbar__text-icon--strike': action.key === 'strike' }">{{ action.text }}</span>
          <OfficeIcon v-if="action.options || action.setColor" name="xiangxiajiantou" :size="10" color="#9aa4b2" background-color="transparent" />
        </button>
      </div>
      <slot />
      <div
        v-if="activeAction && (activeAction.options || activeAction.setColor)" ref="panelRef"
        class="norio-office-rich-text-bubble__panel" :style="panelStyle" role="dialog" :aria-label="activeAction.label"
        @mousedown.stop
      >
        <ColorPalettePanel
          v-if="activeAction.setColor" :color="activeAction.color || activeAction.defaultColor!"
          :default-color="activeAction.defaultColor!" :recent-colors="activeAction.recentColors || []"
          @change="activeAction.setColor"
        />
        <template v-else>
          <button
            v-for="option in activeAction.options" :key="option.key" type="button"
            class="norio-office-rich-text-bubble__option"
            :class="{ 'norio-office-rich-text-bubble__option--active': option.active, 'norio-office-rich-text-bubble__option--divider': option.divider }"
            :disabled="option.disabled" :aria-label="option.label" :aria-pressed="!!option.active" :aria-expanded="option.options ? nestedKey === option.key : undefined" :style="option.fontFamily ? { fontFamily: option.fontFamily } : undefined"
            @mousedown.prevent @mouseenter="openNestedOption(option, $event)" @click="selectOption(option, $event)"
          >
            <OfficeIcon v-if="option.icon" :name="option.icon" :size="16" color="currentColor" background-color="transparent" />
            <span v-else-if="option.text" class="norio-office-rich-text-bubble__option-symbol">{{ option.text }}</span>
            <span class="norio-office-rich-text-bubble__option-label">{{ option.label }}</span>
            <OfficeIcon v-if="option.options" class="norio-office-rich-text-bubble__option-arrow" name="youjiantou" :size="12" color="currentColor" background-color="transparent" />
            <OfficeColorIcon v-if="option.active" name="duihao" :size="14" background-color="transparent" />
          </button>
        </template>
      </div>
      <div
        v-if="nestedAction?.options" ref="nestedPanelRef" class="norio-office-rich-text-bubble__panel norio-office-rich-text-bubble__panel--nested"
        :style="nestedPanelStyle" role="dialog" :aria-label="nestedAction.label" @mousedown.stop
      >
        <button
          v-for="option in nestedAction.options" :key="option.key" type="button" class="norio-office-rich-text-bubble__option"
          :class="{ 'norio-office-rich-text-bubble__option--active': option.active }" :disabled="option.disabled" :aria-label="option.label" :aria-pressed="!!option.active"
          @mousedown.prevent @click="applyOption(option)"
        >
          <span class="norio-office-rich-text-bubble__option-symbol">{{ option.text }}</span>
          <span class="norio-office-rich-text-bubble__option-label">{{ option.label }}</span>
          <OfficeColorIcon v-if="option.active" name="duihao" :size="14" background-color="transparent" />
        </button>
      </div>
    </div>
  </BubbleMenu>
</template>
