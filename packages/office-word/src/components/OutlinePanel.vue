<script setup lang="ts">
import type { RichTextEditorOutlineItem } from '../types'
import OfficeIcon from './OfficeIcon.vue'
import ScrollArea from './ScrollArea.vue'

withDefaults(defineProps<{
  open?: boolean
  placement?: 'left' | 'right'
  title?: string
  collapseTitle?: string
  emptyDescription?: string
  emptyTip?: string
  showCollapse?: boolean
  internal?: boolean
  standalone?: boolean
  items: RichTextEditorOutlineItem[]
  activePos: number | null
}>(), {
  open: true,
  placement: 'right',
  title: '大纲',
  collapseTitle: '收起大纲',
  emptyDescription: '对文档内容应用“标题”样式，即可自动生成大纲。',
  emptyTip: '',
  showCollapse: true,
  internal: false,
  standalone: false,
})

const emit = defineEmits<{
  toggle: []
  select: [pos: number]
}>()
</script>

<template>
  <aside
    class="norio-office-rich-outline"
    :class="{
      'norio-office-rich-outline--internal': internal,
      'norio-office-rich-outline--standalone': standalone,
    }"
    :data-open="open"
    :data-placement="placement"
    :aria-label="title"
    :aria-hidden="!open"
  >
    <div class="norio-office-rich-outline__chrome">
      <div class="norio-office-rich-outline__toolbar">
        <div class="norio-office-rich-outline__title">{{ title }}</div>
        <button
          v-if="showCollapse"
          type="button"
          class="norio-office-rich-outline__collapse"
          :title="collapseTitle"
          @click="emit('toggle')"
        >
          <span class="norio-office-rich-outline__collapse-icon">
            <OfficeIcon name="close" :size="18" color="#64748b" background-color="transparent" />
          </span>
        </button>
      </div>

      <ScrollArea class-name="norio-office-rich-outline__body">
        <div v-if="items.length" class="norio-office-rich-outline__list">
          <button
            v-for="item in items"
            :key="item.pos"
            type="button"
            class="norio-office-rich-outline__item"
            :class="{ 'norio-office-rich-outline__item--active': activePos === item.pos }"
            :data-level="item.level"
            :style="{ '--norio-office-rich-outline-level': String(Math.max(0, item.level - 1)) }"
            @click="emit('select', item.pos)"
          >
            <span class="norio-office-rich-outline__item-text">{{ item.text }}</span>
          </button>
        </div>

        <div v-else class="norio-office-rich-outline__empty">
          <p>{{ emptyDescription }}</p>
          <p v-if="emptyTip">{{ emptyTip }}</p>
        </div>
      </ScrollArea>
    </div>
  </aside>
</template>
