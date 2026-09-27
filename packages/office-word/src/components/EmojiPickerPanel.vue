<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import ScrollArea from './ScrollArea.vue'
import { emojiCategoryTabs, emojiItems, type EmojiCategoryId, type EmojiItem } from '../data/emoji'

const props = withDefaults(defineProps<{
  selectedEmoji?: string | null
}>(), {
  selectedEmoji: null,
})

const emit = defineEmits<{
  select: [emoji: string]
}>()

type EmojiSection = {
  key: string
  title: string
  items: EmojiItem[]
}

const RECENT_STORAGE_KEY = 'office-word:recent-emojis'
const MAX_RECENT_ITEMS = 10
const searchKeyword = ref('')
const activeCategory = ref<EmojiCategoryId>('recent')
const recentEmojis = ref<string[]>([])

const categoryLabelMap = new Map(emojiCategoryTabs.map((tab) => [tab.id, tab.label]))
const nonRecentTabs = emojiCategoryTabs.filter((tab) => tab.id !== 'recent')

const hasSearch = computed(() => searchKeyword.value.trim().length > 0)
const recentItems = computed(() =>
  recentEmojis.value
    .map((emoji) => emojiItems.find((item) => item.emoji === emoji))
    .filter((item): item is EmojiItem => !!item)
    .slice(0, MAX_RECENT_ITEMS),
)

const searchResults = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return []
  }

  return emojiItems.filter((item) => {
    const haystack = [item.label, item.emoji, ...item.keywords].join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
})

const displaySections = computed<EmojiSection[]>(() => {
  if (hasSearch.value) {
    return [{ key: 'search', title: '搜索结果', items: searchResults.value }]
  }

  if (activeCategory.value === 'recent') {
    const sections: EmojiSection[] = []

    if (recentItems.value.length) {
      sections.push({
        key: 'recent-top',
        title: '最近',
        items: recentItems.value,
      })
    }

    for (const tab of nonRecentTabs) {
      const items = emojiItems.filter((item) => item.category === tab.id)
      if (items.length) {
        sections.push({
          key: String(tab.id),
          title: tab.label,
          items,
        })
      }
    }

    return sections
  }

  return [
    {
      key: String(activeCategory.value),
      title: categoryLabelMap.get(activeCategory.value) ?? '表情',
      items: emojiItems.filter((item) => item.category === activeCategory.value),
    },
  ]
})

function loadRecentEmojis() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const storedValue = window.localStorage.getItem(RECENT_STORAGE_KEY)
    if (!storedValue) {
      return
    }

    const parsed = JSON.parse(storedValue)
    if (Array.isArray(parsed)) {
      recentEmojis.value = parsed.filter((value): value is string => typeof value === 'string').slice(0, MAX_RECENT_ITEMS)
    }
  } catch {
    recentEmojis.value = []
  }
}

function persistRecentEmojis(nextItems: string[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(nextItems))
}

function rememberEmoji(emoji: string) {
  const nextItems = [emoji, ...recentEmojis.value.filter((item) => item !== emoji)].slice(0, MAX_RECENT_ITEMS)
  recentEmojis.value = nextItems
  persistRecentEmojis(nextItems)
}

function selectEmoji(emoji: string) {
  rememberEmoji(emoji)
  emit('select', emoji)
}

function setCategory(category: EmojiCategoryId) {
  activeCategory.value = category
}

onMounted(() => {
  loadRecentEmojis()
})
</script>

<template>
  <div class="norio-office-rich-emoji-picker-panel">
    <ScrollArea class-name="norio-office-rich-emoji-picker-panel__body">
      <template v-if="displaySections.length">
        <section
          v-for="section in displaySections"
          :key="section.key"
          class="norio-office-rich-emoji-picker-panel__section"
        >
          <div class="norio-office-rich-emoji-picker-panel__section-title">{{ section.title }}</div>

          <div
            class="norio-office-rich-emoji-picker-panel__grid"
            :class="{ 'norio-office-rich-emoji-picker-panel__grid--recent': section.key === 'recent-top' }"
          >
            <button
              v-for="item in section.items"
              :key="`${section.key}-${item.emoji}`"
              type="button"
              class="norio-office-rich-emoji-picker-panel__item"
              :class="{ 'norio-office-rich-emoji-picker-panel__item--active': props.selectedEmoji === item.emoji }"
              :title="item.label"
              @click="selectEmoji(item.emoji)"
            >
              {{ item.emoji }}
            </button>
          </div>
        </section>
      </template>

      <div v-else class="norio-office-rich-emoji-picker-panel__empty">没有找到匹配的表情</div>
    </ScrollArea>

    <div class="norio-office-rich-emoji-picker-panel__footer">
      <button
        v-for="tab in emojiCategoryTabs"
        :key="tab.id"
        type="button"
        class="norio-office-rich-emoji-picker-panel__tab"
        :class="{ 'norio-office-rich-emoji-picker-panel__tab--active': activeCategory === tab.id }"
        :title="tab.label"
        @click="setCategory(tab.id)"
      >
        <span class="norio-office-rich-emoji-picker-panel__tab-icon" aria-hidden="true">{{ tab.icon }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.norio-office-rich-emoji-picker-panel {
  width: 420px;
  height: 342px;
  display: flex;
  flex-direction: column;
  border: 1px solid #e8edf5;
  border-radius: 0;
  background: #ffffff;
  box-shadow:
    0 18px 42px rgba(15, 23, 42, 0.12),
    0 2px 8px rgba(15, 23, 42, 0.06);
  overflow: hidden;
  box-sizing: border-box;
}

.norio-office-rich-emoji-picker-panel__body {
  flex: 1;
  min-height: 0;
  padding: 14px 16px 12px;
  overflow-y: auto;
  box-sizing: border-box;
}

.norio-office-rich-emoji-picker-panel__section + .norio-office-rich-emoji-picker-panel__section {
  margin-top: 14px;
}

.norio-office-rich-emoji-picker-panel__section-title {
  margin-bottom: 9px;
  color: #667085;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.norio-office-rich-emoji-picker-panel__grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 4px;
}

.norio-office-rich-emoji-picker-panel__grid--recent {
  overflow: hidden;
}

.norio-office-rich-emoji-picker-panel__item {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 0;
  background: transparent;
  font-size: 21px;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    transform 0.14s ease;
}

.norio-office-rich-emoji-picker-panel__item:hover,
.norio-office-rich-emoji-picker-panel__item--active {
  background: #f2f6ff;
}

.norio-office-rich-emoji-picker-panel__item:hover {
  transform: translateY(-1px);
}

.norio-office-rich-emoji-picker-panel__empty {
  padding: 28px 0 20px;
  color: #9ca3af;
  font-size: 14px;
  text-align: center;
}

.norio-office-rich-emoji-picker-panel__footer {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 5px;
  padding: 7px 12px 9px;
  border-top: 1px solid #eef2f7;
  background: #fbfcff;
}

.norio-office-rich-emoji-picker-panel__tab {
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
}

.norio-office-rich-emoji-picker-panel__tab:hover,
.norio-office-rich-emoji-picker-panel__tab--active {
  background: #eef5ff;
}

.norio-office-rich-emoji-picker-panel__tab-icon {
  font-size: 18px;
  line-height: 1;
}
</style>
