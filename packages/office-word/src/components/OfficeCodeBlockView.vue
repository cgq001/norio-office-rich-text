<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/vue-3'

import OfficeColorIcon from './OfficeColorIcon.vue'
import OfficeIcon from './OfficeIcon.vue'
import ScrollArea from './ScrollArea.vue'
import { useNodeViewEditable } from '../composables/useNodeViewEditable'

const props = defineProps<NodeViewProps>()

type ElementLike = HTMLElement | { $el?: Element | null } | null

const wrapperRef = ref<ElementLike>(null)
const languageMenuRef = ref<HTMLElement | null>(null)
const settingsMenuRef = ref<HTMLElement | null>(null)
const isLanguageMenuOpen = ref(false)
const isSettingsMenuOpen = ref(false)
const isCopied = ref(false)
let copyTimer: number | null = null

const languageOptions = [
  { label: 'Plain Text', value: 'plain_text' },
  { label: 'Bash', value: 'bash' },
  { label: 'C#', value: 'csharp' },
  { label: 'C/C++', value: 'cpp' },
  { label: 'CMake', value: 'cmake' },
  { label: 'CSS', value: 'css' },
  { label: 'Dart', value: 'dart' },
  { label: 'Dockerfile', value: 'dockerfile' },
  { label: 'HTML', value: 'html' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'JSON', value: 'json' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'Vue', value: 'vue' },
]

const currentLanguage = computed(() => {
  const value = String(props.node.attrs.language ?? 'plain_text')
  return languageOptions.find((option) => option.value === value) ?? languageOptions[0]
})

const isWrapEnabled = computed(() => Boolean(props.node.attrs.wrapLines))
const isDarkTheme = computed(() => Boolean(props.node.attrs.darkTheme))
const isFixedHeight = computed(() => Boolean(props.node.attrs.fixedHeight))
const canEdit = useNodeViewEditable(props.editor)
const lineNumbers = computed(() => {
  const text = String(props.node.textContent ?? '').replace(/\r\n/g, '\n')
  const lineCount = Math.max(1, text.split('\n').length)
  return Array.from({ length: lineCount }, (_, index) => index + 1)
})

function toggleLanguageMenu() {
  if (!canEdit.value) {
    return
  }

  isLanguageMenuOpen.value = !isLanguageMenuOpen.value
  isSettingsMenuOpen.value = false
}

function toggleSettingsMenu() {
  if (!canEdit.value) {
    return
  }

  isSettingsMenuOpen.value = !isSettingsMenuOpen.value
  isLanguageMenuOpen.value = false
}

function selectLanguage(value: string) {
  if (!canEdit.value) {
    return
  }

  props.updateAttributes({ language: value })
  isLanguageMenuOpen.value = false
}

function toggleWrapLines() {
  if (!canEdit.value) {
    return
  }

  props.updateAttributes({ wrapLines: !isWrapEnabled.value })
}

function toggleDarkTheme() {
  if (!canEdit.value) {
    return
  }

  props.updateAttributes({ darkTheme: !isDarkTheme.value })
}

function toggleFixedHeight() {
  if (!canEdit.value) {
    return
  }

  props.updateAttributes({ fixedHeight: !isFixedHeight.value })
}

async function copyCode() {
  const text = props.node.textContent ?? ''
  if (!text) {
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    isCopied.value = true

    if (copyTimer) {
      window.clearTimeout(copyTimer)
    }

    copyTimer = window.setTimeout(() => {
      isCopied.value = false
      copyTimer = null
    }, 1000)
  } catch {
    // Ignore clipboard failures for now.
  }
}

function handlePointerDown(event: MouseEvent) {
  const target = event.target as Node | null

  if (!target || !languageMenuRef.value?.contains(target)) {
    isLanguageMenuOpen.value = false
  }

  if (!target || !settingsMenuRef.value?.contains(target)) {
    isSettingsMenuOpen.value = false
  }
}

function resolveWrapperElement() {
  if (wrapperRef.value instanceof HTMLElement) {
    return wrapperRef.value
  }

  const element = wrapperRef.value?.$el
  return element instanceof HTMLElement ? element : null
}

function removePlaceholderAttr() {
  resolveWrapperElement()?.removeAttribute('data-placeholder')
}

onMounted(() => {
  document.addEventListener('mousedown', handlePointerDown)
  void nextTick(removePlaceholderAttr)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handlePointerDown)

  if (copyTimer) {
    window.clearTimeout(copyTimer)
  }
})
</script>

<template>
  <NodeViewWrapper
    ref="wrapperRef"
    class="norio-office-rich-code-block"
    :data-wrap-lines="isWrapEnabled ? 'true' : 'false'"
    :data-dark-theme="isDarkTheme ? 'true' : 'false'"
    :data-fixed-height="isFixedHeight ? 'true' : 'false'"
  >
    <div v-if="canEdit" class="norio-office-rich-code-block__toolbar">
      <div ref="languageMenuRef" class="norio-office-rich-code-block__dropdown">
        <button type="button" class="norio-office-rich-code-block__toolbar-button norio-office-rich-code-block__toolbar-button--language" @click="toggleLanguageMenu">
          <span>{{ currentLanguage.label }}</span>
          <OfficeIcon name="xiangxiajiantou" :size="10" color="#6b7280" background-color="transparent" />
        </button>

        <div v-if="isLanguageMenuOpen" class="norio-office-rich-code-block__menu">
          <ScrollArea class-name="norio-office-rich-code-block__menu-scroll" max-height="296px">
            <button
              v-for="option in languageOptions"
              :key="option.value"
              type="button"
              class="norio-office-rich-code-block__menu-item"
              :class="{ 'norio-office-rich-code-block__menu-item--active': currentLanguage.value === option.value }"
              @click="selectLanguage(option.value)"
            >
              <span>{{ option.label }}</span>
              <OfficeColorIcon
                v-if="currentLanguage.value === option.value"
                name="duihao"
                :size="16"
                background-color="transparent"
              />
            </button>
          </ScrollArea>
        </div>
      </div>

      <div class="norio-office-rich-code-block__toolbar-actions">
        <button type="button" class="norio-office-rich-code-block__toolbar-button" @click="copyCode">
          <span>{{ isCopied ? '已复制' : '复制' }}</span>
        </button>

        <div ref="settingsMenuRef" class="norio-office-rich-code-block__dropdown">
          <button type="button" class="norio-office-rich-code-block__toolbar-button" @click="toggleSettingsMenu">
            <span>设置</span>
          </button>

          <div v-if="isSettingsMenuOpen" class="norio-office-rich-code-block__settings-menu">
            <button type="button" class="norio-office-rich-code-block__setting-row" @click="toggleFixedHeight">
              <span>固定高度</span>
              <span class="norio-office-rich-code-block__switch" :data-checked="isFixedHeight ? 'true' : 'false'">
                <span class="norio-office-rich-code-block__switch-thumb" />
              </span>
            </button>

            <button type="button" class="norio-office-rich-code-block__setting-row" @click="toggleWrapLines">
              <span>自动换行</span>
              <span class="norio-office-rich-code-block__switch" :data-checked="isWrapEnabled ? 'true' : 'false'">
                <span class="norio-office-rich-code-block__switch-thumb" />
              </span>
            </button>

            <button type="button" class="norio-office-rich-code-block__setting-row" @click="toggleDarkTheme">
              <span>暗色主题</span>
              <span class="norio-office-rich-code-block__switch" :data-checked="isDarkTheme ? 'true' : 'false'">
                <span class="norio-office-rich-code-block__switch-thumb" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="norio-office-rich-code-block__body" @mousedown.stop="">
      <pre class="norio-office-rich-code-block__surface">
        <div class="norio-office-rich-code-block__line-numbers" aria-hidden="true">
          <span v-for="index in lineNumbers" :key="index" class="norio-office-rich-code-block__line-number">{{ index }}</span>
        </div>
        <NodeViewContent as="code" class="norio-office-rich-code-block__content" />
      </pre>
    </div>
  </NodeViewWrapper>
</template>
