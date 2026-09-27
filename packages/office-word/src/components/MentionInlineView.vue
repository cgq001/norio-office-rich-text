<script setup lang="ts">
import { computed } from 'vue'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/vue-3'

import { getMentionAvatarStyle, getMentionAvatarText } from '../utils/mention'

const props = defineProps<NodeViewProps>()

const mentionId = computed(() => String(props.node.attrs.id ?? ''))
const mentionName = computed(() => String(props.node.attrs.name ?? ''))
const mentionType = computed(() => Number(props.node.attrs.type ?? 1) === 2 ? 2 : 1)
const avatar = computed(() => String(props.node.attrs.avatar ?? ''))
const icon = computed(() => String(props.node.attrs.icon ?? ''))
const tag = computed(() => String(props.node.attrs.tag ?? ''))
const updatedAt = computed(() => String(props.node.attrs.updatedAt ?? ''))
const canEdit = computed(() => props.editor.isEditable)
const fallbackAvatarText = computed(() => getMentionAvatarText(mentionName.value))
const fallbackAvatarStyle = computed(() => getMentionAvatarStyle(mentionId.value))

function getPayload() {
  return {
    id: mentionId.value,
    name: mentionName.value,
    type: mentionType.value,
    avatar: avatar.value || undefined,
    icon: icon.value || undefined,
    tag: tag.value || undefined,
    updatedAt: updatedAt.value || undefined,
  }
}

function selectNode() {
  if (!canEdit.value) {
    return
  }

  const position = props.getPos()
  if (typeof position === 'number') {
    props.editor.commands.setNodeSelection(position)
  }
}

function handleClick() {
  selectNode()
  props.extension.options.onClick?.(getPayload())
}
</script>

<template>
  <NodeViewWrapper
    as="span"
    class="norio-office-rich-mention-inline"
    :class="{
      'norio-office-rich-mention-inline--person': mentionType === 1,
      'norio-office-rich-mention-inline--document': mentionType === 2,
      'norio-office-rich-mention-inline--selected': selected && canEdit,
    }"
    :data-mention-id="mentionId"
    :data-mention-name="mentionName"
    :data-mention-type="mentionType"
    :data-mention-tag="tag"
    @click.stop="handleClick"
  >
    <span class="norio-office-rich-mention-inline__icon">
      <img v-if="mentionType === 1 && avatar" :src="avatar" alt="" />
      <img v-else-if="mentionType === 2 && icon" :src="icon" alt="" />
      <span v-else :style="mentionType === 1 ? fallbackAvatarStyle : undefined">
        {{ mentionType === 1 ? fallbackAvatarText : '文' }}
      </span>
    </span>
    <span class="norio-office-rich-mention-inline__name">{{ mentionName }}</span>
  </NodeViewWrapper>
</template>
