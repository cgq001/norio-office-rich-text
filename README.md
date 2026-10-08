# @norio-office/rich-text

个人开发项目，生产使用前请结合业务场景测试。问题反馈：norio-office@qq.com。

中文 | [English](#english)

## 中文

`@norio-office/rich-text` 是一个基于 Vue 3 和 Tiptap 3 的富文本编辑器组件，内置文档式编辑界面、图片/视频/文件块、表格、公式、倒计时、高亮块、大纲、预览模式、导出能力，以及可选的 Yjs 协同编辑。

本文按当前仓库实现说明。编辑器负责编辑界面和内容结构；保存接口、文件服务器、评论数据库、协同服务器由你的项目提供。下面的 `/api/...` 和 `example.com` 都是示例地址，不是组件自带的服务。

### 从哪里开始

- 第一次接入：[快速开始](#快速开始)，然后看[保存、加载与清空](#保存加载与清空)。
- 上传附件：[上传并插入](#上传并插入)。
- 控制显示的功能：[可用 Key](#可用-key)；限制用户编辑：[预览模式](#预览模式)。
- 自己做按钮：[实例 API](#实例-api)；自己放目录：[外置目录组件](#外置目录组件)。
- 接多人协作：[协同编辑](#协同编辑)；接评论：[评论功能对接](#评论功能对接)。
- 遇到问题：先看[常见问题](#常见问题)。

带完整 `<script setup>` 和 `<template>` 的示例可以作为一个 Vue 组件使用；只有 `<RichTextEditor ... />` 或函数的片段，需要合并到前面的组件中。`yourUploadApi()`、初始化权判断等占位逻辑必须替换成业务实现。

### 安装

```bash
npm install @norio-office/rich-text
```

组件样式会作为独立 CSS 文件发布。建议在应用入口显式引入：

```ts
import '@norio-office/rich-text/style.css'
```

运行环境需要 Vue 3.5+，Tiptap 使用本包声明的 3.x 兼容版本。若包管理器未自动安装 peer dependencies（宿主需要提供的依赖），请按 `package.json` 的版本范围安装，不要混用 Tiptap 2.x 或随意升级到下一主版本：

```bash
npm install vue@^3.5.0 @tiptap/core@^3.22.1 @tiptap/vue-3@^3.22.1 @tiptap/pm@^3.22.1 @tiptap/starter-kit@^3.22.1 @tiptap/extension-placeholder@^3.22.1 @tiptap/extension-code-block@^3.22.1 @tiptap/extension-code-block-lowlight@^3.22.1 @tiptap/extension-collaboration@^3.22.2 @tiptap/extension-collaboration-caret@^3.22.2 @tiptap/extension-font-family@^3.22.1 @tiptap/extension-horizontal-rule@^3.22.1 @tiptap/extension-subscript@^3.22.1 @tiptap/extension-superscript@^3.22.1 @tiptap/extension-table@^3.22.1 @tiptap/extension-table-cell@^3.22.1 @tiptap/extension-table-header@^3.22.1 @tiptap/extension-table-row@^3.22.1 @tiptap/extension-task-item@^3.22.1 @tiptap/extension-task-list@^3.22.1 @tiptap/extension-text-style@^3.22.1 @tiptap/extension-underline@^3.22.1 @tiptap/y-tiptap@^3.0.2 lowlight@^3.3.0 y-prosemirror@^1.2.6 yjs@^13.6.30
```

`html2canvas`、`jspdf`、`katex`、`marked`、`plyr` 已作为普通 dependencies 随包安装。

### 快速开始

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { JSONContent } from '@tiptap/core'
import { RichTextEditor } from '@norio-office/rich-text'
import '@norio-office/rich-text/style.css'

const content = ref<JSONContent>({
  type: 'doc',
  content: [{ type: 'paragraph' }],
})
</script>

<template>
  <RichTextEditor v-model="content" />
</template>
```

也可以使用默认导出：

```ts
import RichTextEditor from '@norio-office/rich-text'
```

这个例子从空文档开始。`content` 是 Tiptap JSON 对象，不是 HTML 字符串；编辑后 `v-model` 会更新这个对象，但不会自动保存到服务器。组件依赖浏览器 DOM，SSR 项目应在客户端挂载它。

### 保存、加载与清空

单人编辑时，把完整 JSON 存入数据库，打开文档时再赋给 `content`。不要只保存 `getText()`，它会丢失标题、颜色、表格和图片等结构。

下面是可独立使用的本地演示：手动保存到浏览器 `localStorage`，重新打开页面时恢复。它不涉及上传或服务器，也不适用于多人协同的内容同步。

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { JSONContent } from '@tiptap/core'
import { RichTextEditor } from '@norio-office/rich-text'
import '@norio-office/rich-text/style.css'

const storageKey = 'rich-text-demo'
const createEmptyDocument = (): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
})
const content = ref<JSONContent>(createEmptyDocument())
const status = ref('')

onMounted(() => {
  try {
    const saved = localStorage.getItem(storageKey)
    if (!saved) return
    const parsed = JSON.parse(saved) as JSONContent
    if (parsed.type !== 'doc' || !Array.isArray(parsed.content)) {
      throw new Error('文档格式不正确')
    }
    content.value = parsed
    status.value = '已恢复上次保存的文档'
  } catch {
    status.value = '读取失败，已打开空文档'
  }
})

function saveDocument() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(content.value))
    status.value = '已保存到当前浏览器'
  } catch {
    status.value = '保存失败，请检查浏览器存储空间或权限'
  }
}

function clearDocument() {
  content.value = createEmptyDocument()
  status.value = '已清空编辑区，点击保存后才覆盖旧存档'
}
</script>

<template>
  <button type="button" @click="saveDocument">保存</button>
  <button type="button" @click="clearDocument">清空</button>
  <span>{{ status }}</span>
  <RichTextEditor v-model="content" document-name="演示文档" />
</template>
```

实际项目可以将 `localStorage` 换成自己的读写接口。若监听 `change` 自动保存，建议做防抖和失败提示；`v-model` 和 `change` 对应同一次内容更新，不要分别调用两次保存接口。

注意：当前实现中，初次挂载不传 `modelValue` 或传 `null`，单人模式会显示内置示例文字，不是空文档；挂载后将它改成 `null` 也不会清空。要清空请传上例的 `{ type: 'doc', content: [{ type: 'paragraph' }] }`。协同模式以 Yjs 为准，不能用这个赋值方式覆盖房间内容。

### Props

| Prop | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `modelValue` | `JSONContent \| null` | `null` | 编辑器 JSON，支持 `v-model`；`null` 不表示清空，见上方示例。 |
| `documentName` | `string` | `''` | 内置导出下载的文件名基础名；组件会自动追加 `.pdf`、`.png` 或 `.html`。 |
| `mode` | `'edit' \| 'preview'` | `'edit'` | 编辑模式或预览模式。 |
| `showToolbar` | `boolean` | `true` | 编辑状态下是否显示顶部工具栏。预览状态下始终隐藏。 |
| `watermark` | `RichTextEditorWatermarkOptions \| null` | `null` | 文档页面文本水印配置；不传或 `text` 为空时不显示水印。 |
| `showOutline` | `boolean` | `true` | 是否启用内置大纲及贴边入口，面板默认收起。设为 `false` 后可以配合外部 `RichTextOutline` 组件自行放置目录。 |
| `outlinePlacement` | `'left' \| 'right'` | `'right'` | 大纲面板位置。 |
| `messages` | `RichTextEditorMessages \| null` | `null` | 覆盖内置 UI 文案。 |
| `featureCodes` | `RichTextEditorCode[] \| null` | `null` | 受控入口的统一白名单，适用边界见下方说明。Vue 模板中写作 `feature-codes`。 |
| `enabledFeatureItems` | `RichTextEditorFeatureItemKey[] \| null` | `null` | 旧版高级功能白名单；未传 `featureCodes` 时生效，支持旧的 `outline`。 |
| `enabledExportItems` | `RichTextEditorExportItemKey[] \| null` | `undefined` | 旧版导出菜单白名单；未传 `featureCodes` 时兼容生效。 |
| `enabledInsertMenuItems` | `RichTextEditorInsertMenuItemKey[] \| null` | `undefined` | 旧版插入菜单白名单；未传 `featureCodes` 时兼容生效。 |
| `enabledToolbarActions` | `RichTextEditorToolbarActionKey[] \| null` | `undefined` | 旧版工具栏能力白名单；未传 `featureCodes` 时兼容生效。 |
| `placeholder` | `string` | `''` | 空内容占位文案。 |
| `mention` | `boolean` | `false` | 是否启用 `@` 提及功能；只有设为 `true` 时输入 `@` 才会打开候选面板，`insertMention()` 才会插入提及节点。 |
| `collaboration` | `RichTextEditorCollaborationOptions \| null` | `undefined` | Yjs 协同配置，在组件创建时使用。 |
| `uploadImage` | `RichTextEditorUploadHook \| null` | `null` | 内置图片选择、图片块上传时调用；返回最终可访问 URL 后组件插入图片。 |
| `uploadVideo` | `RichTextEditorUploadHook \| null` | `null` | 内置视频选择、视频块上传时调用；返回最终可访问 URL 后组件插入视频。 |
| `uploadFile` | `RichTextEditorUploadHook \| null` | `null` | 本地文件选择器上传时调用；返回最终可访问 URL 后组件插入文件卡片。 |
| `onUploadError` | `RichTextEditorUploadErrorHandler \| null` | `null` | 上传失败回调；同时也会触发 `upload-error` 事件。 |
| `mentionProvider` | `RichTextEditorMentionProvider \| null` | `undefined` | `@` 提及候选数据提供函数，兼容用法。 |
| `onMentionSearch` | `RichTextEditorMentionProvider \| null` | `undefined` | `@mention-search` 函数式事件对应的异步候选加载函数；优先于 `mentionProvider`。 |
| `comments` | `RichTextEditorCommentThread[] \| null` | `null` | 评论列表，由业务保存并回传；不写入正文 JSON。 |
| `commentUser` | `RichTextEditorCommentUser \| null` | `null` | 当前评论用户；未传时尝试从协同用户中获取，两者都不可用则不能新建或回复。 |
| `showComments` | `boolean` | `false` | 显示评论入口和侧栏；使用功能白名单时还需包含 `comments`。 |
| `commentMention` | `boolean` | `true` | 评论输入框中的提及开关，与正文 `mention` 独立；白名单还需包含 `mention`。 |
| `uploadCommentImage` | `RichTextEditorUploadHook \| null` | `null` | 评论图片上传；未传时回退到 `uploadImage`。 |
| `commentMentionProvider` | `RichTextEditorCommentMentionProvider \| null` | `null` | 评论提及候选加载函数，与正文候选独立。 |
| `onCommentMentionSearch` | `RichTextEditorCommentMentionProvider \| null` | `null` | 评论候选加载函数的另一种传法；优先于 `commentMentionProvider`。 |

`featureCodes` 不传或为 `null` 时回退到对应的旧版白名单；旧版也未配置时，不限制这些受控功能。评论、正文提及和协同仍需各自的配置。传数组后，优先于四个旧版白名单；传 `[]` 表示不开放受白名单控制的入口。比如 `['pdf', 'image']` 保留底部 PDF/图片导出和图片插入入口。

表中的 `undefined` 表示组件没有给该可选 prop 设置显式默认值，即“未传入”；这些配置传 `null` 同样按未配置处理，白名单会继续使用对应的旧版配置（若有）。

这里的“授权码”是前端功能开关，不是安全权限：基础文字格式仍可使用，当前句柄的插入/转换菜单、拖拽上传和多数实例方法没有统一按此数组过滤，也不会删除文档已有节点。业务权限、上传权限和保存权限需要在业务层及后端校验。新项目建议统一使用 `feature-codes`，不要依赖它实现严格的编辑权限隔离。

### 水印

`watermark` 只作为页面视觉层渲染，不写入编辑器 JSON，也不会影响 `getText()` 的纯文本结果。当前导出清理流程会移除水印层，所以 PDF、图片、HTML 和内置打印输出都不保留它。若业务要求导出水印，需要在业务导出流程中另行处理，不能把页面水印当成文件防泄漏能力。

```vue
<RichTextEditor
  v-model="content"
  :watermark="{
    text: '内部资料',
    color: 'rgba(37, 99, 235, 0.12)',
    fontSize: 20,
    rotate: -24,
    showInEdit: true,
  }"
/>
```

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `text` | `string` | - | 水印文字，必填。 |
| `color` | `string` | `'rgba(15, 23, 42, 0.12)'` | 水印文字颜色。 |
| `fontSize` | `number` | `18` | 水印字号，单位 px。 |
| `rotate` | `number` | `-24` | 水印倾斜角度，单位 deg。 |
| `showInEdit` | `boolean` | `true` | 编辑状态下是否显示水印；预览状态始终按配置显示。 |

旧版白名单兼容示例（不要同时传 `feature-codes`）：

```vue
<RichTextEditor
  v-model="content"
  :enabled-export-items="['html', 'image']"
  :enabled-insert-menu-items="['image', 'local-file', 'blockquote']"
  :enabled-toolbar-actions="['blockquote']"
/>
```

### 可用 Key

所有授权码统一从 `feature-codes` 传入，也可以从包里导入各类 `RICH_TEXT_EDITOR_*_CODES` 避免手写字符串：

```ts
import {
  RICH_TEXT_EDITOR_EXPORT_CODES,
  RICH_TEXT_EDITOR_FEATURE_CODES,
  RICH_TEXT_EDITOR_INSERT_MENU_CODES,
  RICH_TEXT_EDITOR_TOOLBAR_ACTION_CODES,
} from '@norio-office/rich-text'
import type { RichTextEditorCode } from '@norio-office/rich-text'

const featureCodes: RichTextEditorCode[] = [
  RICH_TEXT_EDITOR_EXPORT_CODES.pdf,
  RICH_TEXT_EDITOR_INSERT_MENU_CODES.image,
  RICH_TEXT_EDITOR_FEATURE_CODES.outlineRight,
  RICH_TEXT_EDITOR_TOOLBAR_ACTION_CODES.blockquote,
]
```

上述常量是对象，取其中的值组成数组即可。`featureCodes` 是受控入口共用的白名单；它的适用边界见 Props 下方说明：

```vue
<RichTextEditor
  v-model="content"
  :feature-codes="['pdf', 'image']"
/>
```

上面这个配置会开启 PDF 导出、图片导出和插入图片入口。因为 `image` 是统一授权码，所以它会同时命中导出图片和插入图片。

完整授权码清单：

| Code | 分类 | 控制内容 | 仍需配合的 prop |
| --- | --- | --- | --- |
| `comments` | 高级功能 | 评论按钮、右侧评论栏、正文评论锚点点击和评论交互。 | `showComments`、`comments`、`commentUser` |
| `outlineLeft` | 高级功能 | 内置大纲和贴边图标按钮，授权后位于左侧。 | `showOutline` |
| `outlineRight` | 高级功能 | 内置大纲和贴边图标按钮，授权后位于右侧。 | `showOutline` |
| `watermark` | 高级功能 | 页面水印显示；当前导出不会保留水印。 | `watermark` |
| `collaboration` | 高级功能 | Yjs 协同编辑和协同光标；未授权时按单人模式初始化。 | `collaboration` |
| `mention` | 高级功能 | 正文 `@` 提及、评论输入框里的 `@` 提及弹层和提及实例方法。 | `mention`、`commentMention`、`mentionProvider`、`commentMentionProvider` |
| `pdf` | 导出 | 导出菜单里的 PDF 导出入口。 | `documentName` |
| `html` | 导出 | 导出菜单里的 HTML 导出入口。 | `documentName` |
| `image` | 导出 + 插入 | 导出菜单里的图片导出入口，同时控制插入菜单里的图片入口。 | `uploadImage`、`documentName` |
| `print` | 导出 | 底部信息栏的打印入口。 | - |
| `video` | 插入菜单 | 插入菜单里的视频入口。 | `uploadVideo` |
| `table` | 插入菜单 | 插入菜单里的表格入口。 | - |
| `local-file` | 插入菜单 | 插入菜单里的本地文件入口。 | `uploadFile` |
| `columns` | 插入菜单 | 插入菜单里的分栏入口。 | - |
| `highlight-block` | 插入菜单 | 插入菜单里的高亮块入口。 | - |
| `date` | 插入菜单 | 插入菜单里的日期入口；当前作为授权码预留。 | - |
| `code-block` | 插入菜单 | 插入菜单里的代码块入口。 | - |
| `formula` | 插入菜单 | 插入菜单里的公式入口。 | - |
| `blockquote` | 插入菜单 + 工具栏 | 插入菜单里的引用入口，同时控制工具栏里的引用按钮。 | - |
| `emoji` | 插入菜单 + 工具栏 | 插入菜单里的表情入口，同时控制工具栏里的表情按钮。 | - |
| `link` | 插入菜单 | 插入菜单里的链接入口。 | - |
| `divider` | 插入菜单 | 插入菜单里的分割线入口。 | - |
| `countdown` | 插入菜单 | 插入菜单里的倒计时入口。 | - |
| `markdown-import` | 插入菜单 | 插入菜单里的 Markdown 导入入口。 | - |

同一个 code 只写一次即可；例如 `image` 同时授权图片导出和插入图片，`blockquote` 同时授权插入引用和工具栏引用按钮。

大纲授权规则：`featureCodes` 里只有 `outlineLeft` 时，大纲及入口显示在左侧；只有 `outlineRight` 时显示在右侧；两个都有时按 `outlinePlacement` 决定位置；两个都没有时不显示内置大纲和贴边入口。

举例：想保留评论、正文提及和右侧大纲，可以传 `['comments', 'mention', 'outlineRight']`，同时配置 `:show-comments="true"`、`:mention="true"`、当前用户和各自的数据源。只写 code 不会自动生成评论用户、提及候选或上传接口。

### 复制、剪切和粘贴

先分清两个菜单：选中文字后浮在附近的是“文字气泡”，用来改选中文字的格式；鼠标移到段落、图片、表格等块旁边后出现的按钮是“句柄”，打开的是整块操作菜单。句柄菜单始终操作它对应的块，不一定是光标所在的块。

句柄只在空闲时悬停显示，不会随光标自动出现。输入（包括中文输入法）、拖动选中文字或块框选时，句柄及其菜单会隐藏；有文字、图片、视频、链接或表格气泡菜单时，也不显示句柄。例如，选中文字后只能看到格式气泡，收起选区后再次移动鼠标到块旁边，才会显示句柄。

块侧边菜单与 `Ctrl/Cmd+C`、`Ctrl/Cmd+X`、`Ctrl/Cmd+V` 可以交叉使用，保留表格、高亮块、任务列表、图片等节点类型和属性。菜单粘贴在当前块下方插入，优先读取最新系统剪贴板；普通快捷键粘贴保留文字选区和代码块的原生行为，无需额外对接。

菜单读取剪贴板需要安全上下文（HTTPS 或 localhost）和浏览器权限。读取被拒绝时回退到本编辑器缓存，外部内容可用快捷键粘贴；菜单剪切只有在成功写入系统剪贴板后才删除原节点。

### 块菜单的对齐与颜色

正文和标题的句柄菜单提供“缩进和对齐”：左、中、右对齐显示当前选中项，分割线下方是增加、减少缩进；缩进范围为 0-8，到达边界时对应操作禁用。

“颜色”独立放在“缩进和对齐”下方，可设置字体颜色和文字背景色，每项都有“自定义颜色”入口，打开三级内置颜色选择器。“恢复默认”只清除文字色和背景色，保留字体、字号、加粗等格式。

有序列表和无序列表的句柄菜单也提供“缩进和对齐”，支持左/中/右对齐及增减缩进。操作统一作用于该列表内的正文和标题（包括嵌套项），保留列表结构、编号及文字格式，不影响其他列表；缩进范围为 0–8，各文本块独立限制，设置后菜单保持打开。

句柄菜单顶部的类型按钮会高亮回显当前句柄节点：正文、H1–H6、有序列表、无序列表或待办。回显跟随句柄目标，不受其他位置的光标影响；转换或修改节点后重新打开菜单会显示新类型，插入菜单不会误显示为当前类型。

句柄操作菜单默认以句柄中心上下居中，仅在顶部或底部空间不足时向可视区域内避让。定位按实际菜单高度计算，跟随滚动、窗口尺寸和缩放更新；空行“＋”的插入菜单仍在按钮下方展开。

句柄菜单的“颜色”和“剪切”之间、以及“删除”上方使用统一横线分组，样式与“删除”和添加菜单之间的分割线一致。

句柄菜单提供“在上方添加”和“在下方添加”，分别使用对应方向的图标。两者共用基础/常用节点子菜单，在目标块前后插入并保留原块（包括空段落），支持撤销；窄屏使用带“返回”的子菜单。

编辑器自有弹出菜单统一使用直角，包括工具栏下拉、插入及句柄多级菜单、文字/表格气泡、颜色/表情/@提及面板，以及图片、视频、链接、代码、倒计时、日期和公式的浮动设置。面板、矩形选项和色块均无圆角；头像、单选圆点及开关保留圆形，正文内容块、图片和主工具栏外观不变。

二级、三级颜色菜单选色后保持打开，可连续调整；高亮块边框/填充及分割线颜色同样不会自动关闭。小屏下使用带“返回”的逐级菜单。操作仅作用于句柄对应的块，支持撤销、重做，沿用文档 JSON/HTML 保存，无需新增对接参数。

文字背景色使用现有 `textStyle.backgroundColor`，与高亮块整块填充、表格单元格背景色分别设置。段落、标题、列表、引用和高亮块均支持文字颜色菜单。

### 文字选区气泡菜单

在编辑状态选中文字，会在选区附近显示格式气泡菜单，提供正文/标题、字体、字号、文字色、文字背景色、加粗、斜体、下划线、删除线、上下标、对齐与缩进、行内代码和清除格式。上下标互斥切换；颜色使用内置颜色选择器，最近使用颜色与顶部工具栏共享，选色后不关闭面板。

气泡在选择结束后才出现：按住鼠标拖选时隐藏，松开鼠标后显示；按住 Shift 用方向键扩展选区时隐藏，松开 Shift 后显示。例如，拖选两段文字的过程中不会有菜单挡住正文，松开后才显示格式按钮。重新拖选时，已有气泡也会暂时隐藏。

顶部工具栏和选区气泡菜单的字号选项统一只保留初号、小初、一号、小一、二号、小二、三号、小三、四号、小四、五号、小五，不显示纯数字字号选项；已有文档的字号数据保持不变。

选区气泡的正文按钮显示当前块类型图标；菜单提供正文、一至三级标题、“其他标题”（二级菜单含四至六级）、有序列表、无序列表、任务、代码块、引用和高亮块。代码块与引用之间使用分隔线，代码块、引用、高亮块分别遵循现有 `code-block`、`blockquote`、`highlight-block` 授权码。选择后直接转换或包裹原有内容，不额外插入空块；不提供尚未实现的同步块入口。

操作保留选区：行内格式只修改选中文字，对齐、缩进和标题修改所在块。表格内选中文字、单元格或整表时，统一显示一个表格气泡：上方提供字体、字号、文字色、文字背景色、加粗、斜体、下划线、删除线、对齐与缩进，不提供正文/标题、上下标、行内代码和清除格式；下方提供合并、拆分、单元格背景色、主题色及增删行列等表格操作，不能执行的操作会禁用。例如，只选中单元格中的“评论”二字，改字体、字号或文字颜色不会影响同格其他文字；“文字背景颜色”与整格的“设置单元格背景色”互相独立。拖选期间不显示，选择结束后才出现。收起选区、点击外部或按 Escape 可关闭；小屏自动换行，预览/只读和演示时不显示。文字选区优先显示气泡，并关闭已打开的句柄菜单。无需新增对接参数，格式仍随现有文档 JSON/HTML 保存。

### 表格主题色

选中表格单元格、行或列后，在气泡菜单的“设置单元格背景色”后点击主题图标。内置经典蓝、清新绿、优雅紫、活力橙、玫瑰粉、简约灰，支持分别自定义表头、奇数行、偶数行颜色。

也可以鼠标移入表格，打开左侧块操作菜单，悬停或点击“主题色”。该入口上下使用菜单分割线分隔；这里复用相同主题面板，直接修改该菜单对应的表格，不需要先选中单元格；光标位于另一张表格时也不会改错目标。

点击三个颜色块会打开编辑器自带的颜色面板，包含默认色、色板、标准色、最近使用和“更多颜色”。默认色恢复经典蓝主题对应区域的颜色；最近使用与工具栏背景色面板共享，选择后立即生效。

主题作用于整张表：首行为表头色，第二行开始交替填色，增删行后会自动重新交替。选主题时清除当前表已有的单元格背景覆盖色，之后仍可单独设置单元格背景。“清除样式”清除主题和单元格背景，保留内容、文字格式、合并关系和列宽。

无需额外对接接口；主题保存在现有文档 JSON 的表格节点 `attrs.tableTheme` 中，通过 `v-model` / `change` 一起保存，支持撤销、重做、协同和导出。也可在初始文档的表格节点中传入：

```ts
attrs: {
  tableTheme: { header: '#1670d2', odd: '#e8f2ff', even: '#ffffff' },
}
```

不传 `tableTheme` 或设置为 `null` 时保留原有表格外观。

### 分割线样式与颜色

鼠标移入分割线，打开左侧块操作菜单：

- **样式**：只展示实线、虚线、点状线的预览，悬停可查看名称，点击即可切换。
- **颜色**：复用编辑器颜色面板，支持默认色、色板、标准色、最近使用和更多颜色；默认色恢复原来的浅灰色，最近使用与文字颜色面板共享。

样式和颜色为独立一组，与上方粘贴、下方删除之间使用菜单分割线分隔。

修改只作用于当前菜单对应的分割线，不需要先选中它。无需额外回调；属性保存在 `horizontalRule` 节点中，通过现有 `v-model` / `change` 保存，支持撤销、重做、复制粘贴和导出。初始文档示例：

```ts
{ type: 'horizontalRule', attrs: { lineStyle: 'dashed', lineColor: '#1677ff' } }
```

`lineStyle` 可选 `solid`（实线）、`dashed`（虚线）、`dotted`（点状线）；`lineColor` 使用六位 HEX 色值，`null` 表示默认色。不传属性的旧文档仍显示默认实线。`feature-codes` 中的 `divider` 控制插入入口，无需新增授权码。

### 高亮块颜色与设置

移入高亮块并打开句柄菜单，在“粘贴”和“删除”之间可设置。句柄主菜单按内容撑开，不显示内部滚动条，靠近底部时自动上移：

- **边框颜色**：二级菜单提供预设色、无颜色和恢复默认；“自定义颜色”打开三级内置颜色选择器，支持标准色、最近使用、更多颜色、默认和清除颜色。
- **填充颜色**：独立设置块背景，颜色选择方式同上。
- **设置**：切换“启用表情”；关闭后隐藏左侧表情，开启后可继续点击表情进行选择。

边框和填充独立设置，选色后二级、三级菜单保持打开，可以连续修改；窄屏通过“返回”切换菜单层级。

高亮块不再显示气泡菜单。操作仅影响句柄对应的高亮块，不依赖当前光标位置；属性仍保存在文档 JSON/HTML 中，支持撤销、重做，无需新增对接参数。

### 引用颜色

移入引用块并打开左侧句柄菜单，在“粘贴”和“删除”之间可设置 **边框颜色**、**背景颜色**。二级菜单各提供 15 个预设色，加上无颜色按钮，完整显示两行、每行 8 格；保留原有预设和默认色，并支持恢复默认。“自定义颜色”打开三级内置颜色选择器。选色后菜单保持打开，窄屏通过“返回”切换层级。

修改只作用于句柄对应的引用块，不依赖光标位置；边框色、块背景色、文字颜色互不影响。原顶部工具栏的引用颜色设置保留。数据仍使用 `blockquote.attrs.quoteBorderColor`、`blockquote.attrs.quoteBackgroundColor`，随现有文档 JSON/HTML 保存，支持撤销和重做，无需新增对接参数。

### 图片描述与链接

直接按住图片拖到文档其他位置，会移动原图片，保留宽高、对齐、旋转、描述和链接，不会重复插入。图片组内拖到另一张图片上可调整顺序，拖到组外会移动整组；侧边句柄拖动仍可使用。外部图片文件拖入仍走上传 hook。

直接拖图片、句柄拖动和外部文件拖入的块级落点提示统一为蓝色横线及左端圆点。

选中图片，点击气泡菜单的“设置图片描述”，即可在图片下方直接输入。描述随输入保存，支持换行；清空文字后再按一次 Backspace，会隐藏描述框，不会删除图片。旧文档或上传结果中已有的 `description` 会自动显示，预览/只读时显示为普通文字。

点击“设置图片链接”，在气泡菜单下方弹层输入网址，可勾选“在当前页面打开”。点击“确定”或按 Enter 才保存；“取消”、Escape、点击外部或切换图片均放弃本次修改。清空网址后确定即移除链接，无效网址不会覆盖旧值。

编辑状态下点击已设置链接的图片只选中图片，不会跳转；预览、只读或演示状态下才按配置打开链接。保存与导出仍保留链接数据。

无需新增对接事件，数据通过现有文档 `v-model` / `change` 保存，也可通过 `insertImage()` 传入：

```ts
editorRef.value?.insertImage({
  src: 'https://example.com/photo.png',
  description: '图片描述',
  descriptionVisible: true,
  link: 'https://example.com/details',
  linkTarget: '_blank',
})
```

`descriptionVisible` 可选，不传时根据描述是否为空决定显示；`true` 可显示空描述框，`false` 隐藏描述。`linkTarget` 可选 `_blank`（默认，新页面）或 `_self`（当前页面）。`getImages()` 返回这些字段；描述和已确认链接支持撤销、重做、复制粘贴和导出，未确认的链接草稿不会导出。

### 事件

| 事件 | Payload | 说明 |
| --- | --- | --- |
| `update:modelValue` | `JSONContent` | 内容更新，用于 `v-model`。 |
| `change` | `JSONContent` | 内容更新事件。 |
| `local-file-upload` | `RichTextEditorLocalFilePayload` | 用户通过本地文件选择器插入文件后触发。 |
| `local-file-click` | `RichTextEditorLocalFilePayload` | 用户点击本地文件卡片非下载按钮区域时触发。 |
| `local-file-download` | `RichTextEditorLocalFilePayload` | 用户点击本地文件卡片下载按钮时触发。 |
| `upload-error` | `RichTextEditorUploadErrorPayload` | 图片、视频或文件上传 hook 失败时触发。 |
| `mention-search` | `RichTextEditorMentionProviderPayload` | 函数式监听写法，对应 `onMentionSearch` prop；输入 `@` 后加载候选数据，可返回数组或 `Promise`。 |
| `mention-item-click` | `RichTextEditorMentionItem` | 点击弹窗候选项或已插入的提及节点时触发。 |
| `mention-submit` | `RichTextEditorMentionItem` | 点击弹窗 `提及` 按钮并插入提及节点后触发。 |
| `outline-change` | `RichTextEditorOutlineState` | 大纲条目或当前激活位置更新；可用 `@outline-change` 获取 `{ items, activePos }`。 |

`mention-search` 没有出现在组件的 `defineEmits` 中；Vue 模板里的 `@mention-search="handler"` 会作为 `onMentionSearch` 函数式 prop 传入组件。

评论的创建、回复、删除等事件单独列在[评论事件](#评论事件)中。正文提及加载函数可以返回候选数组；评论的 `@comment-mention-search` 是通知事件，返回值不会被用作候选数据，务必使用对应的 provider prop。

### @ 提及

`mention` 默认关闭。需要提及能力时请显式传入 `:mention="true"`；未开启时输入 `@` 只会保留普通文本，`@mention-search` 不会被调用，`insertMention()` 会返回 `false`。

输入 `@` 会打开候选弹窗。宿主项目通过 `@mention-search` 异步返回候选数据，组件不会内置默认人员或文档数据。推荐使用 `@mention-search`，`mentionProvider` 仅作为函数 prop 兼容保留。

`type: 1` 表示人，`type: 2` 表示文档。人和文档共用 `id`、`name`、`type`、`avatar`、`icon`、`tag`、`updatedAt` 等字段；文档传入 `tag` 时会在标题旁显示标签文字，不传则不显示；人没有头像时会用名字最后两个字和固定亮色颜色池生成头像。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { JSONContent } from '@tiptap/core'
import { RichTextEditor } from '@norio-office/rich-text'
import type {
  RichTextEditorMentionItem,
  RichTextEditorMentionProviderPayload,
} from '@norio-office/rich-text'
import '@norio-office/rich-text/style.css'

const content = ref<JSONContent>({ type: 'doc', content: [{ type: 'paragraph' }] })

const mentionItems: RichTextEditorMentionItem[] = [
  { id: 'user-1001', name: '崔国强', type: 1 },
  { id: 'user-1002', name: '刘佳宁', type: 1 },
  { id: 'doc-2001', name: 'IT资产管理系统', type: 2, tag: '外部', updatedAt: '2025年12月1日' },
  { id: 'doc-2002', name: '客户满意度调研表', type: 2, updatedAt: '2025年12月4日' },
]

async function handleMentionSearch(payload: RichTextEditorMentionProviderPayload) {
  const query = payload.query.trim().toLowerCase()
  await new Promise((resolve) => window.setTimeout(resolve, 120))

  return mentionItems.filter((item) => {
    const matchedType = !payload.type || payload.type === 'all' || item.type === payload.type
    const matchedKeyword = !query || item.name.toLowerCase().includes(query)
    return matchedType && matchedKeyword
  })
}

function handleMentionItemClick(item: RichTextEditorMentionItem) {
  console.log('clicked mention item:', item)
}

function handleMentionSubmit(item: RichTextEditorMentionItem) {
  console.log('inserted mention:', item)
}
</script>

<template>
  <RichTextEditor
    v-model="content"
    :mention="true"
    @mention-search="handleMentionSearch"
    @mention-item-click="handleMentionItemClick"
    @mention-submit="handleMentionSubmit"
  />
</template>
```

点击候选项只会触发 `mention-item-click` 并选中当前项；点击底部 `提及` 按钮才会插入结构化提及节点并触发 `mention-submit`。关闭弹窗或不点击 `提及` 时，编辑器会保留普通 `@` 文本。

### 自定义文案

编辑器默认 UI 文案为中文。`messages` 只会覆盖代码实际读取的文案 key，并非所有界面文字都已经支持替换。句柄菜单和文字选区菜单的部分文案仍是内置中文；传入不存在的 key 不会改变界面。

```vue
<RichTextEditor
  v-model="content"
  :messages="{
    'insert.localFile': '附件',
    'export.label': '下载',
  }"
/>
```

常用文案 key：

| Key | 默认中文 |
| --- | --- |
| `insert.label` | 插入 |
| `insert.section.general` | 通用 |
| `insert.section.apps` | 小应用 |
| `insert.section.external` | 外部内容 |
| `insert.image` | 图片 |
| `insert.video` | 视频 |
| `insert.table` | 表格 |
| `insert.localFile` | 本地文件 |
| `insert.columns` | 分栏 |
| `insert.highlightBlock` | 高亮块 |
| `insert.date` | 日期 |
| `insert.codeBlock` | 代码块 |
| `insert.formula` | 公式 |
| `insert.blockquote` | 引用 |
| `insert.emoji` | 表情符号 |
| `insert.link` | 超链接 |
| `insert.divider` | 分隔线 |
| `insert.countdown` | 倒计时 |
| `insert.markdownImport` | Markdown 导入 |
| `export.label` | 导出 |
| `export.pdf` | 导出 PDF |
| `export.pdf.loading` | 导出 PDF 中... |
| `export.html` | 导出 HTML |
| `export.html.loading` | 导出 HTML 中... |
| `export.image` | 导出图片 |
| `export.image.loading` | 导出图片中... |
| `print.label` | 打印 |
| `print.loading` | 打印中... |
| `quote.apply` | 应用引用 |
| `quote.cancel` | 取消引用 |
| `quote.borderColor` | 边框颜色 |
| `quote.backgroundColor` | 背景颜色 |
| `outline.label` | 大纲 |
| `outline.collapse` | 收起大纲 |
| `outline.empty.description` | 对文档内容应用“标题”样式，即可自动生成大纲。 |
| `outline.empty.tip` | 点击内容区边缘的大纲图标可以展开大纲。 |
| `status.wordCountUnit` | 个字 |
| `status.presentation.enter` | 演示 |
| `status.presentation.exit` | 退出演示 |
| `status.fullscreen.enter` | 全屏 |
| `status.fullscreen.exit` | 退出全屏 |
| `countdown.selectTime` | 请选择时间 |
| `countdown.settingsTitle` | 倒计时设置 |
| `formula.insertTitle` | 插入 LaTeX 公式 |

### 预览模式

`mode="preview"` 会切换到只读预览外壳。预览模式下顶部工具栏、气泡菜单和句柄菜单都不显示，正文不能编辑；图片设置的跳转链接生效，大纲仍可放在左侧或右侧。正文可编辑时，点击图片只用于选中和编辑，不会跳转。

| 配置 | 正文能否编辑 | 顶部工具栏 | 适用场景 |
| --- | --- | --- | --- |
| 默认 `mode="edit"` | 能 | 显示 | 写文档 |
| `mode="edit"`、`:show-toolbar="false"` | 能 | 隐藏 | 只使用选中文字的气泡菜单和块句柄菜单 |
| `mode="preview"` | 不能 | 隐藏 | 阅读/预览 |

这里限制的是用户交互，不是业务 API 的安全边界。业务方仍应避免在只读时主动调用修改内容的方法。

`showToolbar` 默认是 `true`，只控制顶部工具栏，不影响正文编辑、气泡菜单、句柄菜单或底部信息栏。可以动态切换；预览和演示时无论这个属性是什么值，顶部工具栏都会隐藏。

例如，保留编辑能力，但隐藏顶部工具栏：

```vue
<RichTextEditor v-model="content" :show-toolbar="false" />
```

切换成只读预览：

```vue
<RichTextEditor
  v-model="content"
  mode="preview"
  outline-placement="right"
/>
```

窄屏下预览模式会自动缩放页面画布，让文档在手机上保持可读。

底部信息栏提供演示、全屏、缩放、导出和打印入口，顶部工具栏不再显示导出、打印。点击“演示”后，组件临时进入只读预览并全屏显示；按 Esc 或通过浏览器退出全屏后，恢复进入前的编辑/预览状态，不修改业务传入的 `mode` 或文档内容。例如，从编辑页开始演示，退出后可以继续编辑；从预览页开始演示，退出后仍是预览。

### 协同编辑

推荐使用统一协同服务接入当前富文本组件。当前富文本组件的类型是 `rich`，不要把它作为未来 Word 组件的 `documentType=word` 接入。

```bash
npm install yjs y-websocket
```

最小接入示例：

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import type { JSONContent } from '@tiptap/core'
import { RichTextEditor } from '@norio-office/rich-text'
import '@norio-office/rich-text/style.css'

const fileId = 'rich-demo-file-001'
const content = ref<JSONContent | null>(null)
const ydoc = new Y.Doc()

const user = {
  userId: 'user_001',
  userName: 'Alice',
  clientUniqueCode: crypto.randomUUID(),
  color: '#3b82f6',
}

const provider = new WebsocketProvider(
  'ws://127.0.0.1:1234/collaboration',
  fileId,
  ydoc,
  {
    params: {
      roomId: fileId,
      token: 'dev-token',
      userId: user.userId,
      userName: user.userName,
      clientType: 'web',
      clientUniqueCode: user.clientUniqueCode,
      documentType: 'rich',
    },
  },
)

const collaboration = computed(() => ({
  document: ydoc,
  field: 'content',
  provider,
  user: {
    name: user.userName,
    color: user.color,
    userId: user.userId,
    clientUniqueCode: user.clientUniqueCode,
  },
}))

onBeforeUnmount(() => {
  provider.destroy()
  ydoc.destroy()
})
</script>

<template>
  <RichTextEditor
    v-model="content"
    :collaboration="collaboration"
  />
</template>
```

关键规则：

- `WebsocketProvider` 的 room name 和 query 里的 `roomId` 建议保持同一个值。
- 同一个协同房间里的所有客户端必须使用同一个 `field`，普通一文档一编辑器场景固定用 `content`。
- 同一个用户开两个浏览器窗口时，`clientUniqueCode` 必须不同；后端不会按 `userId` 去重在线客户端。
- `provider + user` 都传入时，组件才会显示远程光标和远程选区。
- 协同模式下 Y.Doc/Yjs fragment 是内容事实来源，外部 `modelValue` 不会再作为远程内容的权威写入源。
- 协同扩展在组件创建时配置。切换文档/房间或从单人切换到协同时，应销毁旧 provider/Y.Doc，并用新的 `key` 重新挂载编辑器；只改 prop 不会重建协同扩展。

初始化规则：

- 默认情况下，组件不会把 `modelValue` 写入空的协同 fragment。
- 如果后端已有 Yjs 快照，必须以快照为准，不要传 `initializeContent: true`。
- 如果是全新的空房间，宿主业务必须先确认当前客户端拥有初始化权，再传 `initializeContent: true` 和 `initialContent`。

```ts
const collaboration = computed(() => ({
  document: ydoc,
  field: 'content',
  provider,
  user: { name: user.userName, color: user.color, userId: user.userId },
  initializeContent: ownsInitialContent,
  initialContent: ownsInitialContent ? businessContent : null,
}))
```

两窗口测试时，保持相同 `roomId`，但使用不同 `userId` 和 `clientUniqueCode`。只有第一个窗口应该带初始化权：

```text
http://127.0.0.1:5177/?collab=1&room=rich-demo-file-001&server=ws://127.0.0.1:1234/collaboration&token=dev-token&userId=user_001&name=Alice&clientUniqueCode=browser-tab-001&init=1

http://127.0.0.1:5177/?collab=1&room=rich-demo-file-001&server=ws://127.0.0.1:1234/collaboration&token=dev-token&userId=user_002&name=Bob&clientUniqueCode=browser-tab-002
```

> 本包内置的 `yjs/` 服务示例只适合快速本地验证。生产或完整联调建议使用统一协同后端，例如 `ws://127.0.0.1:1234/collaboration`。

组件支持普通单人编辑，也支持可选的 Yjs 协同编辑。

```vue
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import type { JSONContent } from '@tiptap/core'
import { RichTextEditor } from '@norio-office/rich-text'
import '@norio-office/rich-text/style.css'

const ydoc = new Y.Doc()
const provider = new WebsocketProvider('ws://localhost:1234', 'office-word-demo', ydoc)
const content = ref<JSONContent | null>(null)
onBeforeUnmount(() => {
  provider.destroy()
  ydoc.destroy()
})
</script>

<template>
  <RichTextEditor
    v-model="content"
    :collaboration="{
      document: ydoc,
      field: 'content',
      provider,
      user: {
        name: '张三',
        color: '#3b82f6',
      },
    }"
  />
</template>
```

协同模式下，Yjs fragment 是内容的事实来源。组件仍会 emit JSON 更新，但外部 `modelValue` 的变化不会再反向写入编辑器。如果需要远程光标，请在宿主项目安装 `y-websocket`，并传入 `provider` 和 `user`。

不要把 `modelValue` 当作协同房间的初始化种子。默认情况下，组件不会把 `modelValue` 写入空的协同 fragment；如果全新房间需要默认内容，请先确认当前客户端拥有初始化权，再在 `collaboration` 里传入 `initializeContent: true` 和 `initialContent`。如果后端已经有 Yjs 快照，不要传初始化开关。

### 内置 Yjs 服务示例

发布包内包含一个最小 Yjs WebSocket 服务示例：

```bash
cd node_modules/@norio-office/rich-text/yjs
npm install
npm run start
```

默认监听地址为 `ws://0.0.0.0:1234`。客户端需要使用相同 WebSocket 地址和房间名：

```ts
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const ydoc = new Y.Doc()
const provider = new WebsocketProvider('ws://127.0.0.1:1234', 'office-word-demo', ydoc)
```

### 实例 API

通过 Vue `ref` 获取组件实例方法：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { RichTextEditor } from '@norio-office/rich-text'
import type { RichTextEditorInstance } from '@norio-office/rich-text'

const editorRef = ref<RichTextEditorInstance | null>(null)
</script>

<template>
  <RichTextEditor ref="editorRef" />
</template>
```

可用方法：

| 方法 | 返回值 | 说明 |
| --- | --- | --- |
| `exportPdf()` | `Promise<Blob \| null>` | 导出 PDF。 |
| `exportImage(options?)` | `Promise<Blob \| null>` | 导出图片，支持 PNG/JPEG。 |
| `exportHtml()` | `string \| null` | 导出 HTML 字符串。 |
| `insertImage(payload)` | `boolean` | 插入 1 到 4 张图片。 |
| `insertVideo(payload)` | `boolean` | 插入视频块。 |
| `insertFile(payload)` | `boolean` | 插入链接/文件预览块。 |
| `insertLocalFile(payload)` | `boolean` | 插入本地文件卡片。 |
| `insertMention(payload)` | `boolean` | 插入一个结构化行内提及节点；`mention` 未开启时返回 `false`。 |
| `openLocalFilePicker()` | `void` | 打开本地文件选择器。 |
| `focus()` | `void` | 聚焦编辑器。 |
| `getJSON()` | `JSONContent \| null` | 获取当前 JSON 内容。 |
| `getText()` | `string` | 获取当前纯文本内容，不包含 HTML 标签。 |
| `getImages()` | `RichTextEditorImagePayload[]` | 获取文档内所有图片信息。 |
| `getVideos()` | `RichTextEditorVideoPayload[]` | 获取文档内所有视频信息。 |
| `getFiles()` | `RichTextEditorCollectedFilePayload[]` | 获取文档内所有文件信息；`kind: 'file'` 表示链接/文件预览块，`kind: 'local-file'` 表示本地文件卡片。 |
| `getOutlineItems()` | `RichTextEditorOutlineItem[]` | 获取当前目录项。 |
| `getActiveOutlinePos()` | `number \| null` | 获取当前激活目录项的文档位置。 |
| `focusOutlineItem(pos)` | `boolean` | 聚焦并跳转到指定目录项。 |
| `onOutlineChange(handler)` | `() => void` | 监听目录变化，返回取消监听函数。 |
| `focusCommentThread(threadId)` | `boolean` | 跳转到指定评论锚点；找不到时返回 `false`。 |

媒体插入 API 的位置规则很重要：`insertImage()`、`insertVideo()`、`insertFile()`、`insertLocalFile()` 不会插到一句话的中间。光标所在文本块非空时，在该块前插入并保留原文；为空或只有空白时，替换这个占位块；块级选区则按选区起点插入。若要插到指定位置，先让用户在目标空段落中放置光标再调用。图片数组超过 4 项只取前 4 项。`insertMention()` 则是在当前选区插入行内提及。

这些媒体方法只接收已经上传好的地址，不会调用上传 hook。它们和导出实例方法不受顶部菜单白名单统一限制；媒体方法目前也不会自动检查预览/只读状态，调用方应自行判断。实例尚未就绪或参数缺少必要地址时无法插入，返回 `false`；不要将返回值当作服务器保存成功的确认。

`getImages()`、`getVideos()`、`getFiles()` 返回有效媒体的摘要，不包含上传占位块，也不是完整存档。例如当前返回值没有完整保留 `assetId` 和图片块尺寸，`insertFile()` 当前也没有保存传入的 `assetId`。需要完整数据时请使用 `getJSON()` 或 `v-model`。

### 外置目录组件

内置大纲默认收起，内容区边线中部显示图标按钮。点击后按钮隐藏，大纲作为悬浮层展开，上下及配置的一侧贴住内容区边线，不占正文空间；关闭后恢复按钮。左侧按钮为左直角、右圆角，右侧镜像。底部状态栏不再显示大纲按钮。编辑与预览均支持，演示时隐藏。

内置目录默认跟随编辑器一起渲染。如果需要把目录放到任意侧栏、抽屉或自定义布局里，可以关闭内置目录，并把编辑器实例传给 `RichTextOutline`。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { RichTextEditor, RichTextOutline } from '@norio-office/rich-text'
import type { RichTextEditorInstance } from '@norio-office/rich-text'
import type { JSONContent } from '@tiptap/core'
import '@norio-office/rich-text/style.css'

const editorRef = ref<RichTextEditorInstance | null>(null)
const content = ref<JSONContent>({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '项目说明' }] },
    { type: 'paragraph' },
  ],
})
</script>

<template>
  <RichTextEditor ref="editorRef" v-model="content" :show-outline="false" />
  <aside class="outline-sidebar">
    <RichTextOutline :editor="editorRef" />
  </aside>
</template>
```

`RichTextOutline` 会自动订阅编辑器目录状态，点击条目时会调用 `focusOutlineItem` 跳转到对应标题。组件自身最小高度为 `200px`，默认根据内容自适应增高；如果需要固定高度或内部滚动，请在外层套一个容器控制高度。可选 props：`open`、`placement`、`title`、`collapseTitle`、`emptyDescription`、`emptyTip`、`showCollapse`；事件：`select`、`toggle`、`change`。

### 上传并插入

推荐集成流程：

1. 在业务层上传文件。
2. 等待接口返回可访问 URL。
3. 调用组件实例方法插入返回内容。

这是业务自行上传的方式；如果使用下面的内置上传 hook，组件会自动插入，不要在 hook 中再次调用插入 API，否则会出现重复内容。

如果使用编辑器内置的图片、视频、本地文件选择器或页面拖拽上传，请传入上传 hook。编辑器只负责把用户选中的 `File` 交给业务侧上传，并在 hook 返回 URL 后插入内容；组件不会内置业务上传接口，也不会自动回退为 base64/blob URL。

页面拖拽上传会按文件类型分流：`image/*` 走图片上传，`video/*` 走视频上传，其他格式全部走 `uploadFile` 并插入本地文件卡片。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { JSONContent } from '@tiptap/core'
import { RichTextEditor } from '@norio-office/rich-text'
import type {
  RichTextEditorUploadInput,
  RichTextEditorUploadResult,
  RichTextEditorUploadErrorPayload,
} from '@norio-office/rich-text'
import '@norio-office/rich-text/style.css'

const content = ref<JSONContent>({ type: 'doc', content: [{ type: 'paragraph' }] })

async function uploadToServer(payload: RichTextEditorUploadInput): Promise<RichTextEditorUploadResult> {
  const form = new FormData()
  form.append('file', payload.file)
  form.append('kind', payload.kind)

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    throw new Error('上传失败')
  }

  const result = await response.json() as RichTextEditorUploadResult
  if (!result.url) throw new Error('上传接口没有返回 url')
  return result
}

function handleUploadError(payload: RichTextEditorUploadErrorPayload) {
  console.error(payload.kind, payload.fileName, payload.error)
}
</script>

<template>
  <RichTextEditor
    v-model="content"
    :upload-image="uploadToServer"
    :upload-video="uploadToServer"
    :upload-file="uploadToServer"
    @local-file-click="(file) => console.log('file clicked', file)"
    @upload-error="handleUploadError"
  />
</template>
```

`onUploadError` callback prop 和 `@upload-error` 事件都能接收上传失败信息。通常选择一种接入方式即可，避免业务层重复处理。

上面的 `/api/upload` 是业务自己实现的接口。hook 接收 `{ file: File, kind: 'image' | 'video' | 'file' }`；返回值不是 URL 字符串，而是以下对象：

```json
{
  "url": "https://cdn.example.com/uploads/photo.png",
  "assetId": "asset-1001",
  "name": "photo.png",
  "size": 2048,
  "mimeType": "image/png",
  "alt": "项目照片",
  "description": "本次项目的示意图"
}
```

只有 `url` 必填，其余字段可选；缺少 `name`、`size`、`mimeType` 时，内置上传流程会使用原文件的信息。缺少 hook 会报上传错误，不会自动生成 base64；失败任务可在上传面板重试。评论图片可单独传 `uploadCommentImage`，未传时使用 `uploadImage`。

地址必须能被阅读文档的人访问。不要把本地磁盘路径或临时 `blob:` 地址当成长期文件地址；返回地址和文件权限由业务负责。

插入图片：

```ts
async function uploadImage(file: File) {
  const imageUrl = await yourUploadApi(file)

  editorRef.value?.insertImage({
    src: imageUrl,
    name: file.name,
    alt: file.name,
    description: '',
  })
}
```

一次最多插入 4 张图片：

```ts
editorRef.value?.insertImage([
  { src: 'https://cdn.example.com/a.png', name: 'a.png' },
  { src: 'https://cdn.example.com/b.png', name: 'b.png' },
])
```

插入视频：

```ts
async function uploadVideo(file: File) {
  const videoUrl = await yourUploadApi(file)

  editorRef.value?.insertVideo({
    src: videoUrl,
    name: file.name,
    mimeType: file.type || 'video/mp4',
    description: 'video description',
  })
}
```

插入文件链接/预览块：

```ts
async function uploadFile(file: File) {
  const fileUrl = await yourUploadApi(file)

  editorRef.value?.insertFile({
    url: fileUrl,
    name: file.name,
    displayMode: 'text',
  })
}
```

插入本地文件卡片：

```ts
editorRef.value?.insertLocalFile({
  url: 'https://cdn.example.com/files/demo.txt',
  name: 'demo.txt',
  size: 2048,
  mimeType: 'text/plain',
})
```

### 导出示例

下面的函数与“实例 API”示例中的 `editorRef` 一起使用。内置导出菜单会自动下载；实例方法仅返回 Blob/HTML，下载由你控制。

| 导出方式 | 当前实现与适用范围 |
| --- | --- |
| `exportImage()` | 页面截图；默认 PNG，可选 JPEG。`quality` 可选 0-1，主要影响 JPEG，不传时使用浏览器默认质量。 |
| `exportPdf()` | 简化的 DOM 文字和矩形色块绘制，生成一张随文档高度延伸的 PDF 页面；不是页面截图，也不是 Word 文件。当前不嵌入图片、视频、SVG 图标，不保证字体、公式、圆角、虚线、水印等细节还原。 |
| `exportHtml()` | 含内联样式的完整 HTML 文档；媒体地址仍指向原文件服务，不是离线资源包。 |
| 底部“打印” | 使用浏览器打印流程；需要接近页面原貌的 PDF，可在打印对话框里选择保存为 PDF，并自行检查分页和结果。 |

当前几种导出都先复制页面并清理编辑控件，视频块和页面水印也会被清除。因此不能假设导出文件包含页面上的所有元素；上面的“打印”同样受这项清理影响。

```ts
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function handleExportPdf() {
  const blob = await editorRef.value?.exportPdf()
  if (!blob) return

  downloadBlob(blob, 'demo.pdf')
}

async function handleExportImage() {
  const blob = await editorRef.value?.exportImage({
    type: 'image/png',
  })
  if (!blob) return

  downloadBlob(blob, 'demo.png')
}

function handleExportHtml() {
  const html = editorRef.value?.exportHtml()
  if (!html) return

  console.log(html)
}
```

### 类型导入

```ts
import type {
  OfficeColorIconProps,
  OfficeIconProps,
  RichTextEditorAlign,
  RichTextEditorCollaborationAwareness,
  RichTextEditorCollaborationDocument,
  RichTextEditorCollaborationProvider,
  RichTextEditorCollaborationUser,
  RichTextEditorCollaborationOptions,
  RichTextEditorCollectedFilePayload,
  RichTextEditorExportItemKey,
  RichTextEditorCode,
  RichTextEditorFilePayload,
  RichTextEditorImageExportOptions,
  RichTextEditorImagePayload,
  RichTextEditorInsertMenuItemKey,
  RichTextEditorInstance,
  RichTextEditorLocalFilePayload,
  RichTextEditorMentionItem,
  RichTextEditorMentionProvider,
  RichTextEditorMentionProviderPayload,
  RichTextEditorMentionType,
  RichTextEditorMessages,
  RichTextEditorOutlineChangeHandler,
  RichTextEditorOutlineItem,
  RichTextEditorOutlineState,
  RichTextEditorProps,
  RichTextEditorToolbarActionKey,
  RichTextEditorUploadErrorHandler,
  RichTextEditorUploadErrorPayload,
  RichTextEditorUploadHook,
  RichTextEditorUploadInput,
  RichTextEditorUploadKind,
  RichTextEditorUploadResult,
  RichTextEditorWatermarkOptions,
  RichTextEditorVideoPayload,
} from '@norio-office/rich-text'
```

### 包导出

```ts
import RichTextEditor, {
  RichTextEditor as NamedRichTextEditor,
  RichTextOutline,
  OfficeIcon,
  OfficeColorIcon,
  ScrollArea,
  monoIconNames,
  colorIconNames,
} from '@norio-office/rich-text'
```

### 包内文档

- 使用指南：`docs/usage.md`
- Yjs 服务示例：`yjs/README.md`

### 常见问题

| 问题 | 先检查什么 |
| --- | --- |
| 接入后没有样式 | 是否引入 `@norio-office/rich-text/style.css`，是否由宿主 CSS 覆盖。 |
| 传 `null` 却没有清空 | 传一个包含空段落的 `doc` 对象，见保存示例。 |
| 图片/视频选择后无法上传 | 对应 hook 是否传入，是否返回 `{ url: '...' }`，接口地址是否真实可用。 |
| 调插入方法后图片跑到段落上方 | 媒体 API 默认在非空文本块前插入；指定位置请先把光标放到目标空段落。 |
| 设置了白名单，某些句柄项还在 | 白名单不是完整权限系统；当前句柄插入/转换未统一过滤。 |
| 评论按钮没显示或不能发布 | `showComments`、`comments` code、当前评论用户是否配置；预览不能新建评论。 |
| 输入 `@` 没有候选 | 正文需要 `mention=true` 及数据源；评论使用独立的数据源；白名单需含 `mention`。 |
| 两个窗口内容没有同步 | WebSocket 地址、房间名、`field` 是否一致；白名单是否允许 `collaboration`。 |
| 菜单粘贴读不到系统内容 | 需要 HTTPS/localhost 和浏览器权限，可改用 Ctrl/Cmd+V。 |
| 导出图片缺少远程图片 | 检查图片服务的 CORS、访问权限及加载情况；截图导出依赖浏览器能读取图片。 |
| PDF 里图片或样式不完整 | 当前 PDF 是简化的文字/色块绘制，不嵌入图片；可尝试浏览器打印保存 PDF 并检查结果。 |

长期保存、重新编辑请使用 JSON，评论列表另存；不要将导出 HTML 或简化 PDF 当成无损导入格式。导出前请在目标浏览器验证媒体加载、字体和排版，尤其是包含复杂块的长文档。

## English

`@norio-office/rich-text` is a reusable rich text editor component for Vue 3 and Tiptap 3. It ships with a document-style editing UI, image/video/file blocks, tables, formulas, countdown blocks, highlight blocks, outline navigation, preview mode, export APIs, and optional Yjs collaboration.

### Installation

```bash
npm install @norio-office/rich-text
```

The component styles are published as a separate CSS file. Import it in your application entry:

```ts
import '@norio-office/rich-text/style.css'
```

Use Vue 3.5+ and the compatible Tiptap 3.x ranges declared in `package.json`; do not mix Tiptap major versions. If your package manager does not install peers automatically, use the versioned installation command in the Chinese installation section.

```bash
npm install vue@^3.5.0 @tiptap/core@^3.22.1 @tiptap/vue-3@^3.22.1 @tiptap/pm@^3.22.1 @tiptap/starter-kit@^3.22.1 @tiptap/extension-placeholder@^3.22.1 @tiptap/extension-code-block@^3.22.1 @tiptap/extension-code-block-lowlight@^3.22.1 @tiptap/extension-collaboration@^3.22.2 @tiptap/extension-collaboration-caret@^3.22.2 @tiptap/extension-font-family@^3.22.1 @tiptap/extension-horizontal-rule@^3.22.1 @tiptap/extension-subscript@^3.22.1 @tiptap/extension-superscript@^3.22.1 @tiptap/extension-table@^3.22.1 @tiptap/extension-table-cell@^3.22.1 @tiptap/extension-table-header@^3.22.1 @tiptap/extension-table-row@^3.22.1 @tiptap/extension-task-item@^3.22.1 @tiptap/extension-task-list@^3.22.1 @tiptap/extension-text-style@^3.22.1 @tiptap/extension-underline@^3.22.1 @tiptap/y-tiptap@^3.0.2 lowlight@^3.3.0 y-prosemirror@^1.2.6 yjs@^13.6.30
```

`html2canvas`, `jspdf`, `katex`, `marked`, and `plyr` are regular dependencies and are installed with the package.

### Quick Start

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { JSONContent } from '@tiptap/core'
import { RichTextEditor } from '@norio-office/rich-text'
import '@norio-office/rich-text/style.css'

const content = ref<JSONContent>({ type: 'doc', content: [{ type: 'paragraph' }] })
</script>

<template>
  <RichTextEditor v-model="content" />
</template>
```

Default import is also supported:

```ts
import RichTextEditor from '@norio-office/rich-text'
```

### Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `modelValue` | `JSONContent \| null` | `null` | Tiptap JSON content, not an HTML string. `null` does not clear it. |
| `documentName` | `string` | `''` | Base filename for built-in downloads. The component appends `.pdf`, `.png`, or `.html`. |
| `mode` | `'edit' \| 'preview'` | `'edit'` | Edit mode or read-only preview mode. |
| `showToolbar` | `boolean` | `true` | Shows the top toolbar in edit mode. Always hidden in preview mode. |
| `watermark` | `RichTextEditorWatermarkOptions \| null` | `null` | Text watermark configuration for the document page. No watermark is rendered when omitted or when `text` is empty. |
| `showOutline` | `boolean` | `true` | Enables the built-in outline and edge toggle; the panel starts collapsed. Set it to `false` when placing an external `RichTextOutline` component yourself. |
| `outlinePlacement` | `'left' \| 'right'` | `'right'` | Outline panel placement. |
| `messages` | `RichTextEditorMessages \| null` | `null` | Overrides built-in UI labels. |
| `featureCodes` | `RichTextEditorCode[] \| null` | `null` | Unified whitelist for controlled entries, with the limitations described below. |
| `enabledFeatureItems` | `RichTextEditorFeatureItemKey[] \| null` | `null` | Legacy advanced-feature whitelist, including the legacy `outline` code. |
| `enabledExportItems` | `RichTextEditorExportItemKey[] \| null` | `undefined` | Legacy export menu whitelist; used only when `featureCodes` is unset. |
| `enabledInsertMenuItems` | `RichTextEditorInsertMenuItemKey[] \| null` | `undefined` | Legacy insert menu whitelist; used only when `featureCodes` is unset. |
| `enabledToolbarActions` | `RichTextEditorToolbarActionKey[] \| null` | `undefined` | Legacy toolbar action whitelist; used only when `featureCodes` is unset. |
| `placeholder` | `string` | `''` | Placeholder text for empty content. |
| `mention` | `boolean` | `false` | Enables `@` mention. Only when `true`, typing `@` opens the candidate popup and `insertMention()` can insert a mention node. |
| `collaboration` | `RichTextEditorCollaborationOptions \| null` | `undefined` | Yjs collaboration options, used at component creation. |
| `uploadImage` | `RichTextEditorUploadHook \| null` | `null` | Upload hook required by built-in image pickers and image drops. The editor inserts the returned URL. |
| `uploadVideo` | `RichTextEditorUploadHook \| null` | `null` | Upload hook required by built-in video pickers and video drops. The editor inserts the returned URL. |
| `uploadFile` | `RichTextEditorUploadHook \| null` | `null` | Upload hook required by the local file card picker. The editor inserts the returned URL. |
| `onUploadError` | `RichTextEditorUploadErrorHandler \| null` | `null` | Optional callback for upload errors. |
| `mentionProvider` | `RichTextEditorMentionProvider \| null` | `undefined` | Compatibility function prop for loading `@` mention candidates. |
| `onMentionSearch` | `RichTextEditorMentionProvider \| null` | `undefined` | Async loader used by function-style `@mention-search`; takes precedence over `mentionProvider`. |
| `comments` | `RichTextEditorCommentThread[] \| null` | `null` | Business-managed comment threads, stored separately from document JSON. |
| `commentUser` | `RichTextEditorCommentUser \| null` | `null` | Current author; falls back to the collaboration user when available. |
| `showComments` | `boolean` | `false` | Shows comment UI; also requires the `comments` code when using a whitelist. |
| `commentMention` | `boolean` | `true` | Comment mention switch, independent of the main editor's `mention` prop. |
| `uploadCommentImage` | `RichTextEditorUploadHook \| null` | `null` | Comment image upload hook; falls back to `uploadImage`. |
| `commentMentionProvider` | `RichTextEditorCommentMentionProvider \| null` | `null` | Separate loader for comment mentions. |
| `onCommentMentionSearch` | `RichTextEditorCommentMentionProvider \| null` | `null` | Alternative comment mention loader, taking precedence over `commentMentionProvider`. |

When `featureCodes` is omitted or null, each area falls back to its legacy whitelist; without either list, controlled entries are unrestricted. Comments, mentions and collaboration still need their own configuration. A supplied array takes precedence over legacy lists; `[]` disables only whitelist-controlled entries. These codes are UI switches, not security permissions: basic formatting, current handle insert/transform menus, file drops and most instance methods are not uniformly filtered. Existing nodes are not removed. Enforce business permissions on the host and server.

Persist the full JSON to reopen an editable document; `getText()` and exported HTML are not lossless substitutes. Comments are stored separately. On initial non-collaborative mount, missing/null content currently displays built-in sample text; subsequent null assignments are ignored. Clear with `{ type: 'doc', content: [{ type: 'paragraph' }] }`. Collaboration uses Yjs instead of model-value assignments. See the Chinese save/load example for a complete localStorage demo.

### Watermark

`watermark` is a visual page layer, not document JSON, and does not affect `getText()`. The current export cleanup removes that layer from PDF, image, HTML and built-in print output. Add export watermarks in your host export workflow when required; the on-screen layer is not file-level data-loss protection.

```vue
<RichTextEditor
  v-model="content"
  :watermark="{
    text: 'Internal',
    color: 'rgba(37, 99, 235, 0.12)',
    fontSize: 20,
    rotate: -24,
    showInEdit: true,
  }"
/>
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `text` | `string` | - | Watermark text. Required. |
| `color` | `string` | `'rgba(15, 23, 42, 0.12)'` | Watermark text color. |
| `fontSize` | `number` | `18` | Watermark font size in px. |
| `rotate` | `number` | `-24` | Watermark rotation in degrees. |
| `showInEdit` | `boolean` | `true` | Whether to show the watermark while editing. Preview mode still renders it when configured. |

```vue
<RichTextEditor
  v-model="content"
  :enabled-export-items="['html', 'image']"
  :enabled-insert-menu-items="['image', 'local-file', 'blockquote']"
  :enabled-toolbar-actions="['blockquote']"
/>
```

### Available Keys

All authorization codes are passed through one `feature-codes` list. Import the `RICH_TEXT_EDITOR_*_CODES` constants to avoid hand-written strings:

```ts
import {
  RICH_TEXT_EDITOR_EXPORT_CODES,
  RICH_TEXT_EDITOR_FEATURE_CODES,
  RICH_TEXT_EDITOR_INSERT_MENU_CODES,
  RICH_TEXT_EDITOR_TOOLBAR_ACTION_CODES,
} from '@norio-office/rich-text'

import type { RichTextEditorCode } from '@norio-office/rich-text'

const featureCodes: RichTextEditorCode[] = [
  RICH_TEXT_EDITOR_EXPORT_CODES.pdf,
  RICH_TEXT_EDITOR_INSERT_MENU_CODES.image,
  RICH_TEXT_EDITOR_FEATURE_CODES.outlineRight,
  RICH_TEXT_EDITOR_TOOLBAR_ACTION_CODES.blockquote,
]
```

`featureCodes` is one unified authorization pool. Export, insert menu, toolbar, and advanced features are all checked against the same array:

```vue
<RichTextEditor
  v-model="content"
  :feature-codes="['pdf', 'image']"
/>
```

This enables PDF export, image export, and the insert-image entry. Because `image` is a unified code, it matches both image export and image insertion.

Complete authorization code list:

| Code | Group | Controls | Related props |
| --- | --- | --- | --- |
| `comments` | Advanced feature | Comment button, right-side comment panel, document comment anchor clicks, and comment interactions. | `showComments`, `comments`, `commentUser` |
| `outlineLeft` | Advanced feature | Built-in outline and edge icon toggle on the left. | `showOutline` |
| `outlineRight` | Advanced feature | Built-in outline and edge icon toggle on the right. | `showOutline` |
| `watermark` | Advanced feature | Page watermark display; current exports remove this layer. | `watermark` |
| `collaboration` | Advanced feature | Yjs collaboration and remote cursors; without authorization, the editor initializes in single-user mode. | `collaboration` |
| `mention` | Advanced feature | Main editor `@` mention, comment input `@` mention popup, and mention instance methods. | `mention`, `commentMention`, `mentionProvider`, `commentMentionProvider` |
| `pdf` | Export | PDF export entry in the export menu. | `documentName` |
| `html` | Export | HTML export entry in the export menu. | `documentName` |
| `image` | Export + insert | Image export entry in the export menu and image entry in the insert menu. | `uploadImage`, `documentName` |
| `print` | Export | Print entry in the bottom status bar. | - |
| `video` | Insert menu | Video entry in the insert menu. | `uploadVideo` |
| `table` | Insert menu | Table entry in the insert menu. | - |
| `local-file` | Insert menu | Local file entry in the insert menu. | `uploadFile` |
| `columns` | Insert menu | Columns entry in the insert menu. | - |
| `highlight-block` | Insert menu | Highlight block entry in the insert menu. | - |
| `date` | Insert menu | Date entry in the insert menu; currently reserved as an authorization code. | - |
| `code-block` | Insert menu | Code block entry in the insert menu. | - |
| `formula` | Insert menu | Formula entry in the insert menu. | - |
| `blockquote` | Insert menu + toolbar | Blockquote entry in the insert menu and blockquote button in the toolbar. | - |
| `emoji` | Insert menu + toolbar | Emoji entry in the insert menu and emoji button in the toolbar. | - |
| `link` | Insert menu | Link entry in the insert menu. | - |
| `divider` | Insert menu | Divider entry in the insert menu. | - |
| `countdown` | Insert menu | Countdown entry in the insert menu. | - |
| `markdown-import` | Insert menu | Markdown import entry in the insert menu. | - |

Write a shared code only once. For example, `image` authorizes both image export and image insertion; `blockquote` authorizes both insert-menu blockquote and the toolbar blockquote button.

Outline authorization rule: with only `outlineLeft`, the outline and its edge toggle appear on the left; with only `outlineRight`, they appear on the right; with both, `outlinePlacement` decides placement; with neither, the built-in outline and edge toggle are hidden.

### Copy, Cut, And Paste

Block-menu actions interoperate with `Ctrl/Cmd+C`, `Ctrl/Cmd+X`, and `Ctrl/Cmd+V`, preserving node types, attributes, and formatting. Menu paste inserts below the current block and prefers the latest system clipboard. Native paste keeps text-selection and code-block semantics. No additional integration is required.

Menu clipboard reads require a secure context (HTTPS or localhost) and browser permission. If reads are denied, the editor falls back to its local copy cache; use keyboard paste for external content. Menu cut deletes the source only after a successful rich clipboard write.

### Block Alignment And Colors

Block handles appear only on idle hover, not automatically at the caret. Typing (including IME composition), dragging a text selection, and block marquee selection hide the handles and their menus. Text, image, video, link, and table bubbles take priority over handles. For example, selecting text shows only its formatting bubble; collapse the selection and hover over a block again to reveal its handle.

Paragraph, heading, ordered-list, and bullet-list handle menus provide left/center/right alignment with an active check, followed by separated increase/decrease indent actions. A list handle updates its paragraph/heading content, including nested items, while preserving list structure, numbering, marks, and unrelated blocks. Mixed alignments show no check; indentation is limited to 0-8 per text block, with actions disabled only when no target can change.

The type buttons highlight the handle target's current paragraph, H1-H6, ordered/bullet/task-list type, independently of the caret. Active buttons expose `aria-pressed` and use the same blue styling for their text and icons. Reopening after a conversion reflects the new type; insertion controls have no current-type highlight.

Handle menus provide Add Above and Add Below with corresponding directional icons. Both reuse the basic/common insertion submenu and insert at the target block's boundaries without replacing it, including empty paragraphs. Insertions support undo; narrow screens use a submenu with a Back button.

Action menus center vertically on the handle using their measured height, shifting only to stay within the visible editor/window intersection. Placement updates on scroll, resize, and zoom. Empty-line plus/insert menus still open below their button.

Editor-owned popup menus, panels, and their rectangular controls use square corners, including dropdowns, nested handle menus, bubbles, palettes, emoji/mention panels, and floating media/code/date/formula editing controls. Semantic circles (avatars, radio dots, switches) and document surfaces retain their existing shapes. Native browser pickers are not restyled.

The separate **Color** entry provides font and text-background presets and per-field custom colors in a third-level shared palette. Restore-default clears only these two color attributes, preserving fonts, sizes, and other formatting. Paragraphs, headings, lists, blockquotes, and highlight blocks support text colors; text backgrounds use the existing `textStyle.backgroundColor` mark independently of highlight-block fills and table-cell backgrounds.

Second/third-level color menus remain open after changes, including highlight-block border/fill and divider color palettes. Narrow viewports use stacked menus with back navigation. Changes target the handle block, support undo/redo and existing JSON/HTML persistence, and require no new integration API.

### Text Selection Bubble

Selecting text in edit mode shows paragraph/headings, font family/size, text/background colors, bold/italic/underline/strike, superscript/subscript, alignment/indentation, inline code, and clear-format controls. Actions reuse the toolbar commands and preserve the selection. Superscript/subscript are mutually exclusive; color palettes share recent colors with the toolbar and remain open after changes.

The bubble appears after selection finishes, not during a mouse drag. It stays hidden until the pointer is released, or until Shift is released after expanding a selection with navigation keys. Starting another selection temporarily hides an existing bubble. For example, dragging across two paragraphs leaves the text unobstructed; releasing the mouse reveals the formatting controls.

The block-type button shows the current type's icon. Its dropdown offers paragraph, headings 1-3, a nested headings 4-6 menu, ordered/bullet/task lists, code blocks, then a separator followed by quotes and highlight blocks. Code, quote, and highlight options respect the existing `code-block`, `blockquote`, and `highlight-block` feature codes. Choices transform or wrap the existing content rather than insert empty blocks. Font-size menus offer only the 12 Chinese named sizes, without numeric-only options.

Inline formatting affects only the selected text, while heading/alignment/indentation changes affect its blocks. Text, cell, and whole-table selections share one table bubble: font, size, text/background colors, bold, italic, underline, strike, and alignment/indentation above, and merge/split, cell background, theme, and row/column actions below. The table bubble omits block type, superscript/subscript, inline code, and clear formatting. Unavailable operations are disabled. For example, changing the font or color of a selected word does not change the rest of its cell; text background and whole-cell background are separate. The bubble stays hidden during selection gestures and appears when they finish. Outside clicks, collapsed selections, and Escape dismiss the menu. It wraps on narrow screens and is hidden in preview/read-only or presentation. A text selection takes priority and closes any open handle menu. No new integration API or document attributes are required.

### Table Themes

Select table cells, rows, or columns, then click the theme icon after the cell-background button in the bubble menu. Six presets (blue, green, purple, orange, pink, and gray) and custom header, odd-row, and even-row colors are available.

Alternatively, hover over a table, open its left-hand block menu, then hover or click Theme Color. Separators appear above and below this entry. This opens the same panel and updates that menu's table without requiring a cell selection, even when the caret is in another table.

Each custom color opens the editor's shared palette with Default, swatches, standard colors, recent colors, and More Colors. Default restores that region's classic-blue color. Recent colors are shared with the toolbar background-color palette, and changes apply immediately.

The first row receives the header color; data rows start at the second row and alternate automatically after rows are inserted or removed. Applying a theme removes existing cell background overrides; individual cells can be recolored afterward. Clear Styles removes the theme and cell backgrounds while preserving content, text formatting, merged cells, and column widths.

No extra integration callback is required. Table themes are saved in `attrs.tableTheme` through the existing document `v-model` / `change` flow, and support undo/redo, collaboration, and exports. To initialize a themed table, supply:

```ts
attrs: {
  tableTheme: { header: '#1670d2', odd: '#e8f2ff', even: '#ffffff' },
}
```

Omit `tableTheme` or set it to `null` to retain the default table appearance.

### Divider Style And Color

Hover over a divider and open its left-hand block menu. Style and Color form a separate group between Paste and Delete, with separators above and below. Style shows only solid, dashed, and dotted previews, with names in hover tooltips. Color uses the shared editor palette, including Default, swatches, standard colors, recent colors, and More Colors. Default restores the original light gray; recent colors are shared with text colors.

Only that menu's divider is modified; no selection or additional callback is required. The existing document `v-model` / `change` flow persists its attributes, with undo/redo, clipboard, and export support:

```ts
{ type: 'horizontalRule', attrs: { lineStyle: 'dashed', lineColor: '#1677ff' } }
```

`lineStyle` accepts `solid`, `dashed`, or `dotted`. `lineColor` accepts six-digit HEX colors or `null` for the default. Old documents without these attributes retain the default solid line. The existing `divider` feature code controls insertion; no new authorization code is needed.

### Highlight Block Colors And Settings

The highlight-block handle menu provides **Border Color**, **Fill Color**, and **Settings** between paste and delete. The main handle menu grows naturally without an internal scrollbar and shifts upward near the bottom edge. Each color menu has second-level presets, no-color, and restore-default actions; Custom Color opens the shared third-level palette with standard, recent, custom, default, and clear-color actions. Border and fill remain independent, and both menu levels stay open after selection. Narrow viewports use back navigation between levels. Settings contains the emoji enable/disable switch; enabling it restores the inline emoji picker.

Highlight blocks no longer show a bubble menu. Changes target the hovered block rather than the caret, preserve document JSON/HTML attributes, and support undo/redo. No new integration props or events are required.

### Quote Colors

The blockquote handle menu exposes **Border Color** and **Background Color** between paste and delete. Each second-level palette contains 15 colors plus no-color, filling two complete rows of 8 swatches while preserving existing presets and defaults. Restore-default remains available; Custom Color opens the shared third-level picker. Both levels remain open after changes, with back navigation on narrow screens.

Changes target the handle's blockquote independently of the caret, other surface colors, and text marks. The toolbar quote picker remains available. Colors persist through the existing `blockquote.attrs.quoteBorderColor` and `blockquote.attrs.quoteBackgroundColor` JSON/HTML attributes, with undo/redo support and no new integration API.

### Image Captions And Links

Dragging an image to another position in the same editor moves the original block and preserves dimensions, alignment, rotation, captions, and links without inserting a duplicate. Dragging within a group reorders its items; dropping outside moves the entire group. Side-handle dragging and external image-file upload hooks remain available.

Native image dragging, side-handle dragging, and external file upload use matching blue block drop lines with a left-end dot.

Select an image and use its caption action to type directly below it. Captions save while typing and support multiple lines. After clearing the text, one extra Backspace hides only the caption input. Existing descriptions display automatically; preview/read-only modes use plain text.

The link action opens a popover below the toolbar with a URL, an Open In Current Page checkbox, Cancel, and Confirm. Only Confirm or Enter saves. Cancel, Escape, outside clicks, and selecting another image discard drafts. Confirm an empty URL to remove a link; invalid URLs do not replace existing values.

In edit mode, clicking a linked image selects it without navigation. Links open with their configured target only in preview, read-only, or presentation mode. Saved documents and exports still retain the link.

No additional integration events are required. Document `v-model` / `change` and `insertImage()` accept `description`, optional `descriptionVisible` (otherwise inferred from the description), `link`, and optional `linkTarget` (`_blank` by default, or `_self`). `getImages()` retains these fields. Undo/redo, clipboard, and exports preserve saved captions and confirmed links, but not link drafts.

### Events

| Event | Payload | Description |
| --- | --- | --- |
| `update:modelValue` | `JSONContent` | Content update event used by `v-model`. |
| `change` | `JSONContent` | Content update event. |
| `local-file-upload` | `RichTextEditorLocalFilePayload` | Emitted after a local file is picked and inserted. |
| `local-file-click` | `RichTextEditorLocalFilePayload` | Emitted when the user clicks the non-download area of a local file card. |
| `local-file-download` | `RichTextEditorLocalFilePayload` | Emitted when the local file card download button is clicked. |
| `upload-error` | `RichTextEditorUploadErrorPayload` | Emitted when an image, video, or file upload hook fails. |
| `mention-search` | `RichTextEditorMentionProviderPayload` | Function-style listener syntax for the `onMentionSearch` prop; loads candidates after the user types `@`; may return an array or a `Promise`. |
| `mention-item-click` | `RichTextEditorMentionItem` | Emitted when a popup candidate or inserted mention node is clicked. |
| `mention-submit` | `RichTextEditorMentionItem` | Emitted after the popup `提及` button inserts the selected mention. |
| `outline-change` | `RichTextEditorOutlineState` | Emits `{ items, activePos }` when the outline or active position changes. |

`mention-search` is not declared in the component's `defineEmits`. In Vue templates, `@mention-search="handler"` is passed to the component as the `onMentionSearch` function prop.

### @ Mention

`mention` is disabled by default. Pass `:mention="true"` to enable it. When it is disabled, typing `@` stays as plain text, `@mention-search` is not called, and `insertMention()` returns `false`.

Typing `@` opens the mention popup when `mention` is enabled. The host application provides candidates with async `@mention-search`; the reusable editor does not ship built-in people or document data. Prefer `@mention-search`; `mentionProvider` remains available as a compatibility function prop.

`type: 1` means person and `type: 2` means document. People and documents share the same shape: `id`, `name`, `type`, `avatar`, `icon`, `tag`, `updatedAt`, and related metadata. When a document has `tag`, the popup displays that label next to the title; when it is omitted, no label is shown. When a person has no avatar, the editor displays the last two characters of the name on a stable color selected from a bright 20-color pool.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { JSONContent } from '@tiptap/core'
import { RichTextEditor } from '@norio-office/rich-text'
import type {
  RichTextEditorMentionItem,
  RichTextEditorMentionProviderPayload,
} from '@norio-office/rich-text'
import '@norio-office/rich-text/style.css'

const content = ref<JSONContent>({ type: 'doc', content: [{ type: 'paragraph' }] })

const mentionItems: RichTextEditorMentionItem[] = [
  { id: 'user-1001', name: 'Cui Guoqiang', type: 1 },
  { id: 'user-1002', name: 'Liu Jianing', type: 1 },
  { id: 'doc-2001', name: 'IT Asset Management System', type: 2, tag: 'External', updatedAt: '2025-12-01' },
  { id: 'doc-2002', name: 'Customer Satisfaction Survey', type: 2, updatedAt: '2025-12-04' },
]

async function handleMentionSearch(payload: RichTextEditorMentionProviderPayload) {
  const query = payload.query.trim().toLowerCase()
  await new Promise((resolve) => window.setTimeout(resolve, 120))

  return mentionItems.filter((item) => {
    const matchedType = !payload.type || payload.type === 'all' || item.type === payload.type
    const matchedKeyword = !query || item.name.toLowerCase().includes(query)
    return matchedType && matchedKeyword
  })
}

function handleMentionItemClick(item: RichTextEditorMentionItem) {
  console.log('clicked mention item:', item)
}

function handleMentionSubmit(item: RichTextEditorMentionItem) {
  console.log('inserted mention:', item)
}
</script>

<template>
  <RichTextEditor
    v-model="content"
    :mention="true"
    @mention-search="handleMentionSearch"
    @mention-item-click="handleMentionItemClick"
    @mention-submit="handleMentionSubmit"
  />
</template>
```

Clicking a candidate only selects it and emits `mention-item-click`; clicking the bottom `提及` button inserts the structured inline mention and emits `mention-submit`. Closing the popup without submitting keeps the typed `@` as normal text.

### Custom Labels

The default UI labels are Chinese. `messages` only overrides keys actually read by the implementation. Some handle and selection-menu labels remain hard-coded Chinese; unknown keys have no effect.

```vue
<RichTextEditor
  v-model="content"
  :messages="{
    'insert.localFile': 'Attachment',
    'export.label': 'Download',
  }"
/>
```

Common message keys:

| Key | Default Chinese | English meaning |
| --- | --- | --- |
| `insert.label` | 插入 | Insert |
| `insert.section.general` | 通用 | General |
| `insert.section.apps` | 小应用 | Apps |
| `insert.section.external` | 外部内容 | External content |
| `insert.image` | 图片 | Image |
| `insert.video` | 视频 | Video |
| `insert.table` | 表格 | Table |
| `insert.localFile` | 本地文件 | Local file |
| `insert.columns` | 分栏 | Columns |
| `insert.highlightBlock` | 高亮块 | Highlight block |
| `insert.date` | 日期 | Date |
| `insert.codeBlock` | 代码块 | Code block |
| `insert.formula` | 公式 | Formula |
| `insert.blockquote` | 引用 | Quote |
| `insert.emoji` | 表情符号 | Emoji |
| `insert.link` | 超链接 | Link |
| `insert.divider` | 分隔线 | Divider |
| `insert.countdown` | 倒计时 | Countdown |
| `insert.markdownImport` | Markdown 导入 | Markdown import |
| `export.label` | 导出 | Export |
| `export.pdf` | 导出 PDF | Export PDF |
| `export.pdf.loading` | 导出 PDF 中... | Exporting PDF... |
| `export.html` | 导出 HTML | Export HTML |
| `export.html.loading` | 导出 HTML 中... | Exporting HTML... |
| `export.image` | 导出图片 | Export image |
| `export.image.loading` | 导出图片中... | Exporting image... |
| `print.label` | 打印 | Print |
| `print.loading` | 打印中... | Printing... |
| `quote.apply` | 应用引用 | Apply quote |
| `quote.cancel` | 取消引用 | Cancel quote |
| `quote.borderColor` | 边框颜色 | Border color |
| `quote.backgroundColor` | 背景颜色 | Background color |
| `outline.label` | 大纲 | Outline |
| `outline.collapse` | 收起大纲 | Collapse outline |
| `outline.empty.description` | 对文档内容应用“标题”样式，即可自动生成大纲。 | Apply heading styles to generate an outline. |
| `outline.empty.tip` | 点击内容区边缘的大纲图标可以展开大纲。 | Use the outline icon at the content-area edge to open the outline. |
| `status.wordCountUnit` | 个字 | characters |
| `status.presentation.enter` | 演示 | Present |
| `status.presentation.exit` | 退出演示 | Exit presentation |
| `status.fullscreen.enter` | 全屏 | Fullscreen |
| `status.fullscreen.exit` | 退出全屏 | Exit fullscreen |
| `countdown.selectTime` | 请选择时间 | Select time |
| `countdown.settingsTitle` | 倒计时设置 | Countdown settings |
| `formula.insertTitle` | 插入 LaTeX 公式 | Insert LaTeX formula |

### Preview Mode

Host code must still guard calls to mutating instance methods in preview mode. The component needs a browser DOM; mount client-side in SSR applications.

Use `mode="preview"` to switch the component into a read-only preview shell. The top toolbar, bubble menus, and block handle menus are hidden, editing is disabled, image links work, and the outline can be placed on either side. When editing is enabled, clicking an image selects it for editing instead of following its link.

`showToolbar` defaults to `true` and can be changed dynamically. It only controls the top toolbar, not editing, bubble menus, block handle menus, or the bottom status bar. Preview and presentation always hide the top toolbar, regardless of this prop.

For example, hide the top toolbar while keeping the document editable:

```vue
<RichTextEditor v-model="content" :show-toolbar="false" />
```

For read-only preview:

```vue
<RichTextEditor
  v-model="content"
  mode="preview"
  outline-placement="right"
/>
```

On narrow screens, preview mode automatically scales the page canvas so the document stays readable on phones.

Presentation, fullscreen, zoom, export, and print are available in the bottom status bar; export and print are no longer in the top toolbar. Presentation temporarily switches the component to read-only preview in fullscreen. Pressing Escape or leaving fullscreen through the browser restores the original edit/preview state without modifying the host's `mode` or document content. For example, starting from edit mode returns to editing, while starting from preview remains in preview.

### Collaboration

Use the unified collaboration service for the current rich text editor. The current component type is `rich`; `word` is reserved for a future dedicated Word component.

```bash
npm install yjs y-websocket
```

Minimal integration:

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import type { JSONContent } from '@tiptap/core'
import { RichTextEditor } from '@norio-office/rich-text'
import '@norio-office/rich-text/style.css'

const fileId = 'rich-demo-file-001'
const content = ref<JSONContent | null>(null)
const ydoc = new Y.Doc()

const user = {
  userId: 'user_001',
  userName: 'Alice',
  clientUniqueCode: crypto.randomUUID(),
  color: '#3b82f6',
}

const provider = new WebsocketProvider(
  'ws://127.0.0.1:1234/collaboration',
  fileId,
  ydoc,
  {
    params: {
      roomId: fileId,
      token: 'dev-token',
      userId: user.userId,
      userName: user.userName,
      clientType: 'web',
      clientUniqueCode: user.clientUniqueCode,
      documentType: 'rich',
    },
  },
)

const collaboration = computed(() => ({
  document: ydoc,
  field: 'content',
  provider,
  user: {
    name: user.userName,
    color: user.color,
    userId: user.userId,
    clientUniqueCode: user.clientUniqueCode,
  },
}))
onBeforeUnmount(() => {
  provider.destroy()
  ydoc.destroy()
})
</script>

<template>
  <RichTextEditor
    v-model="content"
    :collaboration="collaboration"
  />
</template>
```

Rules:

- Keep the `WebsocketProvider` room name and query `roomId` the same.
- All clients in the same room must use the same `field`; for normal one-file-one-editor use, keep it as `content`.
- If the same user opens two browser windows, each window must use a different `clientUniqueCode`.
- Collaboration extensions are configured at creation. When changing rooms or switching editing modes, destroy the old provider/document and remount with a new Vue key; changing props alone does not rebuild the extensions.
- Remote cursors and selections require both `provider` and `user`.
- In collaboration mode, the Y.Doc/Yjs fragment is authoritative. External `modelValue` is only an emitted snapshot and must not continuously drive remote collaborative content.

Initialization:

- By default, the editor does not write `modelValue` into an empty collaborative fragment.
- If the backend already has a Yjs snapshot, that snapshot must win. Do not pass `initializeContent: true`.
- For a brand-new empty room, the host application must first confirm that this client owns initialization, then pass `initializeContent: true` and `initialContent`.

```ts
const collaboration = computed(() => ({
  document: ydoc,
  field: 'content',
  provider,
  user: { name: user.userName, color: user.color, userId: user.userId },
  initializeContent: ownsInitialContent,
  initialContent: ownsInitialContent ? businessContent : null,
}))
```

For two-window testing, use the same `roomId`, different `userId` values, and different `clientUniqueCode` values. Only the first window should own initialization:

```text
http://127.0.0.1:5177/?collab=1&room=rich-demo-file-001&server=ws://127.0.0.1:1234/collaboration&token=dev-token&userId=user_001&name=Alice&clientUniqueCode=browser-tab-001&init=1

http://127.0.0.1:5177/?collab=1&room=rich-demo-file-001&server=ws://127.0.0.1:1234/collaboration&token=dev-token&userId=user_002&name=Bob&clientUniqueCode=browser-tab-002
```

The bundled `yjs/` server is useful for quick local checks. For full integration, prefer the unified collaboration backend, for example `ws://127.0.0.1:1234/collaboration`.

The component supports both normal single-user editing and optional Yjs collaboration.

```vue
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import type { JSONContent } from '@tiptap/core'
import { RichTextEditor } from '@norio-office/rich-text'
import '@norio-office/rich-text/style.css'

const ydoc = new Y.Doc()
const provider = new WebsocketProvider('ws://localhost:1234', 'office-word-demo', ydoc)
const content = ref<JSONContent | null>(null)
onBeforeUnmount(() => {
  provider.destroy()
  ydoc.destroy()
})
</script>

<template>
  <RichTextEditor
    v-model="content"
    :collaboration="{
      document: ydoc,
      field: 'content',
      provider,
      user: {
        name: 'Zhang San',
        color: '#3b82f6',
      },
    }"
  />
</template>
```

In collaboration mode, the shared Yjs fragment becomes the source of truth. The component still emits JSON updates, but external `modelValue` changes are not pushed back into the editor. If you want remote cursors, install `y-websocket` in the host project and pass `provider` plus `user`.

Do not use `modelValue` as the initial seed source for a collaborative room. The editor does not write `modelValue` into an empty collaborative fragment by default. If a brand-new room needs initial business content, first confirm this client owns initialization, then pass `initializeContent: true` and `initialContent` inside `collaboration`. Do not set those flags when a backend Yjs snapshot already exists.

### Bundled Yjs Server Example

The published package includes a minimal Yjs WebSocket server example under `yjs/`.

```bash
cd node_modules/@norio-office/rich-text/yjs
npm install
npm run start
```

The default address is `ws://0.0.0.0:1234`. Use the same WebSocket address and room name on every client:

```ts
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const ydoc = new Y.Doc()
const provider = new WebsocketProvider('ws://127.0.0.1:1234', 'office-word-demo', ydoc)
```

### Instance API

Use a Vue `ref` to access the editor instance methods:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { RichTextEditor } from '@norio-office/rich-text'
import type { RichTextEditorInstance } from '@norio-office/rich-text'

const editorRef = ref<RichTextEditorInstance | null>(null)
</script>

<template>
  <RichTextEditor ref="editorRef" />
</template>
```

Available methods:

| Method | Return | Description |
| --- | --- | --- |
| `exportPdf()` | `Promise<Blob \| null>` | Exports a PDF. |
| `exportImage(options?)` | `Promise<Blob \| null>` | Exports an image as PNG or JPEG. |
| `exportHtml()` | `string \| null` | Exports an HTML string. |
| `insertImage(payload)` | `boolean` | Inserts 1 to 4 images. |
| `insertVideo(payload)` | `boolean` | Inserts a video block. |
| `insertFile(payload)` | `boolean` | Inserts a link/file preview block. |
| `insertLocalFile(payload)` | `boolean` | Inserts a local file card. |
| `insertMention(payload)` | `boolean` | Inserts one structured inline mention node; returns `false` when `mention` is disabled. |
| `openLocalFilePicker()` | `void` | Opens the local file picker. |
| `focus()` | `void` | Focuses the editor. |
| `getJSON()` | `JSONContent \| null` | Returns the current JSON document. |
| `getText()` | `string` | Returns the current plain text content without HTML tags. |
| `getImages()` | `RichTextEditorImagePayload[]` | Returns all images in the document. |
| `getVideos()` | `RichTextEditorVideoPayload[]` | Returns all videos in the document. |
| `getFiles()` | `RichTextEditorCollectedFilePayload[]` | Returns all files in the document. `kind: 'file'` means a link/file preview block, and `kind: 'local-file'` means a local file card. |
| `getOutlineItems()` | `RichTextEditorOutlineItem[]` | Returns the current outline items. |
| `getActiveOutlinePos()` | `number \| null` | Returns the document position of the active outline item. |
| `focusOutlineItem(pos)` | `boolean` | Focuses and scrolls to an outline item. |
| `onOutlineChange(handler)` | `() => void` | Subscribes to outline changes and returns an unsubscribe function. |
| `focusCommentThread(threadId)` | `boolean` | Focuses a comment anchor; returns false if not found. |

Media insertion methods insert before the current nonempty text block, preserving it; empty/whitespace text blocks are replaced, and block-level selections insert at their starting position. They do not insert in the middle of a sentence. Place the caret in a target empty paragraph for explicit placement. They accept already-uploaded URLs and do not call upload hooks or uniformly enforce whitelist/read-only settings; check permissions in your host code. Image arrays are truncated to four items. Media getters return summaries of valid media, not a complete archive; current summaries omit `assetId` and image-block dimensions, and `insertFile()` does not persist `assetId`. Save JSON for full fidelity.

### External Outline Component

The built-in outline starts collapsed with an icon button halfway down the configured content-area edge. Opening it hides the button and shows a floating panel flush with the top, bottom, and outer edge without reflowing the document. Closing restores the button. The left button has square left corners and rounded right corners; the right button is mirrored. The status bar no longer contains an outline toggle. Edit and preview modes support it; presentation hides it.

The editor renders its built-in outline by default. To place the outline in any sidebar, drawer, or custom layout, hide the built-in panel and pass the editor instance to `RichTextOutline`.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { RichTextEditor, RichTextOutline } from '@norio-office/rich-text'
import type { RichTextEditorInstance } from '@norio-office/rich-text'
import type { JSONContent } from '@tiptap/core'
import '@norio-office/rich-text/style.css'

const editorRef = ref<RichTextEditorInstance | null>(null)
const content = ref<JSONContent>({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Project Notes' }] },
    { type: 'paragraph' },
  ],
})
</script>

<template>
  <RichTextEditor ref="editorRef" v-model="content" :show-outline="false" />
  <aside class="outline-sidebar">
    <RichTextOutline :editor="editorRef" />
  </aside>
</template>
```

`RichTextOutline` subscribes to the editor outline state automatically. Clicking an item calls `focusOutlineItem` on the editor instance. The component has a `200px` minimum height and grows with its content by default; wrap it with your own container when you need a fixed height or internal scrolling. Optional props: `open`, `placement`, `title`, `collapseTitle`, `emptyDescription`, `emptyTip`, and `showCollapse`. Events: `select`, `toggle`, and `change`.

### Upload And Insert

Recommended integration flow:

1. Upload the asset from your own business layer.
2. Wait for the API to return the final accessible URL.
3. Call the editor instance method to insert the returned content.

The built-in image, video, and local-file pickers, as well as page-level drag
upload, follow the same boundary: the editor only passes the selected `File` to
`uploadImage`, `uploadVideo`, or `uploadFile`, then inserts the URL returned by
that hook. The package does not upload to a business API by itself and does not
fall back to base64/blob URLs.

Page-level drag upload routes files by MIME type: `image/*` uses image upload,
`video/*` uses video upload, and every other file type uses `uploadFile` and is
inserted as a local file card.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { JSONContent } from '@tiptap/core'
import { RichTextEditor } from '@norio-office/rich-text'
import type {
  RichTextEditorUploadInput,
  RichTextEditorUploadResult,
  RichTextEditorUploadErrorPayload,
} from '@norio-office/rich-text'
import '@norio-office/rich-text/style.css'

const content = ref<JSONContent>({ type: 'doc', content: [{ type: 'paragraph' }] })

async function uploadToServer(payload: RichTextEditorUploadInput): Promise<RichTextEditorUploadResult> {
  const form = new FormData()
  form.append('file', payload.file)
  form.append('kind', payload.kind)

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    throw new Error('Upload failed')
  }

  const result = await response.json() as RichTextEditorUploadResult
  if (!result.url) throw new Error('Upload response is missing url')
  return result
}

function handleUploadError(payload: RichTextEditorUploadErrorPayload) {
  console.error(payload.kind, payload.fileName, payload.error)
}
</script>

<template>
  <RichTextEditor
    v-model="content"
    :upload-image="uploadToServer"
    :upload-video="uploadToServer"
    :upload-file="uploadToServer"
    @local-file-click="(file) => console.log('file clicked', file)"
    @upload-error="handleUploadError"
  />
</template>
```

Both the `onUploadError` callback prop and the `@upload-error` event can receive upload failures. In most apps, choose one style to avoid duplicate business handling.

Insert image:

```ts
async function uploadImage(file: File) {
  const imageUrl = await yourUploadApi(file)

  editorRef.value?.insertImage({
    src: imageUrl,
    name: file.name,
    alt: file.name,
    description: '',
  })
}
```

You can insert up to 4 images in one call:

```ts
editorRef.value?.insertImage([
  { src: 'https://cdn.example.com/a.png', name: 'a.png' },
  { src: 'https://cdn.example.com/b.png', name: 'b.png' },
])
```

Insert video:

```ts
async function uploadVideo(file: File) {
  const videoUrl = await yourUploadApi(file)

  editorRef.value?.insertVideo({
    src: videoUrl,
    name: file.name,
    mimeType: file.type || 'video/mp4',
    description: 'video description',
  })
}
```

Insert file link or preview:

```ts
async function uploadFile(file: File) {
  const fileUrl = await yourUploadApi(file)

  editorRef.value?.insertFile({
    url: fileUrl,
    name: file.name,
    displayMode: 'text',
  })
}
```

Insert a local file card:

```ts
editorRef.value?.insertLocalFile({
  url: 'https://cdn.example.com/files/demo.txt',
  name: 'demo.txt',
  size: 2048,
  mimeType: 'text/plain',
})
```

### Export Example

Use these functions with the `editorRef` from Instance API. Built-in menus download automatically; instance methods only return data. Upload hooks must return an object with a required `url`, not a URL string, and should not call insertion methods again. Demo API URLs must be replaced by your own backend.

Image export captures the page (PNG by default; JPEG supports quality 0-1). PDF export instead uses a simplified DOM text/rectangle renderer on one document-height page, without embedding images, videos or SVG icons, and without guaranteeing complex font/formula/border/watermark fidelity. For a more faithful PDF, try the browser's Print / Save as PDF and verify it. HTML exports a complete styled document but does not bundle remote media. Persist JSON for editing, not these export formats.

All built-in export paths clone and clean the page first, removing editing controls, video blocks and watermark layers. Built-in print shares this cleanup; it is not an exact export of every on-screen element.

```ts
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function handleExportPdf() {
  const blob = await editorRef.value?.exportPdf()
  if (!blob) return

  downloadBlob(blob, 'demo.pdf')
}

async function handleExportImage() {
  const blob = await editorRef.value?.exportImage({
    type: 'image/png',
  })
  if (!blob) return

  downloadBlob(blob, 'demo.png')
}

function handleExportHtml() {
  const html = editorRef.value?.exportHtml()
  if (!html) return

  console.log(html)
}
```

### Type Imports

```ts
import type {
  OfficeColorIconProps,
  OfficeIconProps,
  RichTextEditorAlign,
  RichTextEditorCollaborationAwareness,
  RichTextEditorCollaborationDocument,
  RichTextEditorCollaborationProvider,
  RichTextEditorCollaborationUser,
  RichTextEditorCollaborationOptions,
  RichTextEditorCollectedFilePayload,
  RichTextEditorExportItemKey,
  RichTextEditorFilePayload,
  RichTextEditorImageExportOptions,
  RichTextEditorImagePayload,
  RichTextEditorInsertMenuItemKey,
  RichTextEditorInstance,
  RichTextEditorLocalFilePayload,
  RichTextEditorMentionItem,
  RichTextEditorMentionProvider,
  RichTextEditorMentionProviderPayload,
  RichTextEditorMentionType,
  RichTextEditorMessages,
  RichTextEditorOutlineChangeHandler,
  RichTextEditorOutlineItem,
  RichTextEditorOutlineState,
  RichTextEditorProps,
  RichTextEditorToolbarActionKey,
  RichTextEditorUploadErrorHandler,
  RichTextEditorUploadErrorPayload,
  RichTextEditorUploadHook,
  RichTextEditorUploadInput,
  RichTextEditorUploadKind,
  RichTextEditorUploadResult,
  RichTextEditorWatermarkOptions,
  RichTextEditorVideoPayload,
} from '@norio-office/rich-text'
```

### Package Exports

```ts
import RichTextEditor, {
  RichTextEditor as NamedRichTextEditor,
  RichTextOutline,
  OfficeIcon,
  OfficeColorIcon,
  ScrollArea,
  monoIconNames,
  colorIconNames,
} from '@norio-office/rich-text'
```

### Package Docs

- Usage guide: `docs/usage.md`
- Bundled Yjs server example: `yjs/README.md`

## 评论功能对接

评论功能由组件负责右侧栏 UI、正文锚点标注、回复交互、图片预览和评论输入框里的 `@` 弹层；评论数据本身由业务系统保存。对接时可以把它理解成：组件抛事件，业务保存数据，然后把新的 `comments` 数组再传回组件。

下面是一个完整的本地演示，包含：

- 当前评论用户假数据
- 已有评论线程假数据
- 评论图片上传 mock
- 评论里的 `@用户` / `@文档` 查询假数据
- 新建、回复、编辑、删除、完成评论的本地更新逻辑
- `comment-submit` 统一通知事件，用来拿到“评论了谁、@了谁、评论内容”等信息

```vue
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { RichTextEditor } from '@norio-office/rich-text'
import type {
  RichTextEditorCommentCreatePayload,
  RichTextEditorCommentDeletePayload,
  RichTextEditorCommentMentionProviderPayload,
  RichTextEditorCommentReplyPayload,
  RichTextEditorCommentResolvePayload,
  RichTextEditorCommentSubmitPayload,
  RichTextEditorCommentThread,
  RichTextEditorCommentUpdatePayload,
  RichTextEditorCommentUser,
  RichTextEditorMentionItem,
  RichTextEditorUploadInput,
  RichTextEditorUploadResult,
} from '@norio-office/rich-text'
import '@norio-office/rich-text/style.css'

const content = ref({
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: '评论对接示例文档' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: '选中这段文字后点击工具栏评论按钮，就可以新建评论。' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '评论输入框里输入 @',
          marks: [{ type: 'commentMark', attrs: { threadId: 'thread-demo-1' } }],
        },
        { type: 'text', text: ' 可以选择用户或文档。' },
      ],
    },
  ],
})

const commentUser: RichTextEditorCommentUser = {
  id: 'user-current',
  name: '当前用户',
  color: '#2563eb',
}

const mentionOptions: RichTextEditorMentionItem[] = [
  { id: 'user-001', name: '崔国强', type: 1 },
  { id: 'user-002', name: '张晓明', type: 1 },
  { id: 'user-003', name: '李思雨', type: 1 },
  { id: 'doc-001', name: '产品需求文档', type: 2, tag: '文档', updatedAt: '今天 10:30' },
  { id: 'doc-002', name: '协同功能设计稿', type: 2, tag: '外部', updatedAt: '昨天 19:17' },
  { id: 'doc-003', name: '上线检查清单', type: 2, tag: '模板', updatedAt: '2026-05-17' },
]

const comments = ref<RichTextEditorCommentThread[]>([
  {
    id: 'thread-demo-1',
    anchorText: '评论输入框里输入 @',
    status: 'open',
    comments: [
      {
        id: 'comment-demo-1',
        content: '这里可以 @张晓明 看一下评论提及。',
        mentions: [{ id: 'user-002', name: '张晓明', type: 1 }],
        author: { id: 'user-001', name: '崔国强', color: '#4c7dff' },
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
      {
        id: 'comment-demo-2',
        parentId: 'comment-demo-1',
        content: '收到，也可以关联 @产品需求文档。',
        mentions: [{ id: 'doc-001', name: '产品需求文档', type: 2, tag: '文档' }],
        author: { id: 'user-002', name: '张晓明', color: '#16a34a' },
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
    ],
  },
])

const demoObjectUrls: string[] = []
onBeforeUnmount(() => demoObjectUrls.forEach(url => URL.revokeObjectURL(url)))

async function uploadCommentImage(payload: RichTextEditorUploadInput): Promise<RichTextEditorUploadResult> {
  // 真实项目里改成上传到文件服务，然后返回 url/name/size/mimeType。
  const url = URL.createObjectURL(payload.file)
  demoObjectUrls.push(url)
  return {
    url,
    name: payload.file.name,
    size: payload.file.size,
    mimeType: payload.file.type,
  }
}

async function handleCommentMentionSearch(payload: RichTextEditorCommentMentionProviderPayload): Promise<RichTextEditorMentionItem[]> {
  // 真实项目里按 payload.query、payload.type、payload.threadId 等调用接口。
  const keyword = payload.query.trim().toLowerCase()

  return mentionOptions.filter((item) => {
    const typeMatched = payload.type === 'all' || !payload.type || item.type === payload.type
    const keywordMatched = !keyword || item.name.toLowerCase().includes(keyword) || item.id.toLowerCase().includes(keyword)
    return typeMatched && keywordMatched
  })
}

function handleCommentCreate(payload: RichTextEditorCommentCreatePayload) {
  comments.value = [
    ...comments.value,
    {
      id: payload.threadId,
      anchorText: payload.anchorText,
      status: 'open',
      comments: [
        {
          id: payload.commentId,
          content: payload.content,
          images: payload.images,
          mentions: payload.mentions,
          author: payload.author,
          createdAt: payload.createdAt,
        },
      ],
    },
  ]
}

function handleCommentReply(payload: RichTextEditorCommentReplyPayload) {
  comments.value = comments.value.map((thread) =>
    thread.id === payload.threadId
      ? {
          ...thread,
          comments: [
            ...thread.comments,
            {
              id: payload.commentId,
              parentId: payload.parentId,
              content: payload.content,
              images: payload.images,
              mentions: payload.mentions,
              author: payload.author,
              createdAt: payload.createdAt,
            },
          ],
        }
      : thread,
  )
}

function handleCommentUpdate(payload: RichTextEditorCommentUpdatePayload) {
  comments.value = comments.value.map((thread) =>
    thread.id === payload.threadId
      ? {
          ...thread,
          comments: thread.comments.map((item) =>
            item.id === payload.commentId
              ? {
                  ...item,
                  content: payload.content,
                  images: payload.images ?? item.images,
                  mentions: payload.mentions,
                  updatedAt: payload.updatedAt,
                }
              : item,
          ),
        }
      : thread,
  )
}

function handleCommentDelete(payload: RichTextEditorCommentDeletePayload) {
  if (!payload.commentId) {
    comments.value = comments.value.filter((thread) => thread.id !== payload.threadId)
    return
  }

  comments.value = comments.value
    .map((thread) =>
      thread.id === payload.threadId
        ? {
            ...thread,
            comments: thread.comments.filter((item) => item.id !== payload.commentId && item.parentId !== payload.commentId),
          }
        : thread,
    )
    .filter((thread) => thread.comments.length > 0)
}

function handleCommentResolve(payload: RichTextEditorCommentResolvePayload) {
  comments.value = comments.value.map((thread) =>
    thread.id === payload.threadId
      ? { ...thread, status: payload.resolved ? 'resolved' : 'open' }
      : thread,
  )
}

function handleCommentSubmit(payload: RichTextEditorCommentSubmitPayload) {
  // 这个事件适合做通知、消息流、审计日志。
  // payload.content：评论内容
  // payload.mentions：本次评论 @ 的用户/文档
  // payload.targetUserId / targetCommentId：回复别人时，被回复用户和评论 ID
  console.log('comment submit:', payload)
}
</script>

<template>
  <RichTextEditor
    v-model="content"
    :comments="comments"
    :comment-user="commentUser"
    :show-comments="true"
    :upload-comment-image="uploadCommentImage"
    :comment-mention-provider="handleCommentMentionSearch"
    @comment-create="handleCommentCreate"
    @comment-reply="handleCommentReply"
    @comment-update="handleCommentUpdate"
    @comment-delete="handleCommentDelete"
    @comment-resolve="handleCommentResolve"
    @comment-submit="handleCommentSubmit"
  />
</template>
```

### 评论 Props

上例数据只在内存中更新，刷新页面会丢失；mock 图片地址只在本次页面生命周期有效。生产中必须换成持久化接口和长期可访问的图片 URL。`comment-submit` 是同一次操作的汇总通知，不要与 `comment-create/reply/update` 再重复写入同一条评论。用户身份和编辑/删除权限仍应由后端校验。

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `comments` | `RichTextEditorCommentThread[] \| null` | 评论线程列表，业务方持久化并回传。 |
| `commentUser` | `RichTextEditorCommentUser \| null` | 当前评论用户；未传时尝试使用协同用户，两者都不可用时不能新建或回复。 |
| `showComments` | `boolean` | 是否显示评论功能；为 `true` 时显示工具栏评论按钮和右侧评论栏，为 `false` 或不传时隐藏评论入口和评论栏。 |
| `uploadCommentImage` | `RichTextEditorUploadHook \| null` | 评论图片上传 hook，返回结构同 `uploadImage`；未传时会回退使用 `uploadImage`。 |
| `commentMention` | `boolean` | 是否启用评论输入框里的 `@` 提及，默认启用。 |
| `commentMentionProvider` | `RichTextEditorCommentMentionProvider \| null` | 评论 `@` 查询数据源，独立于正文 `mentionProvider`。 |
| `onCommentMentionSearch` | `RichTextEditorCommentMentionProvider \| null` | 评论 `@` 查询函数的另一种传入方式，独立于正文 `onMentionSearch`。 |

### 评论事件

| 事件 | Payload | 说明 |
| --- | --- | --- |
| `comment-create` | `RichTextEditorCommentCreatePayload` | 用户选中文字并发布第一条评论时触发。 |
| `comment-reply` | `RichTextEditorCommentReplyPayload` | 用户在已有评论线程下回复时触发；回复某人时会带 `parentId`、`targetUserId`、`targetCommentId`。 |
| `comment-update` | `RichTextEditorCommentUpdatePayload` | 用户编辑评论内容时触发。 |
| `comment-delete` | `RichTextEditorCommentDeletePayload` | 删除单条评论或整个评论线程时触发。 |
| `comment-resolve` | `RichTextEditorCommentResolvePayload` | 用户点击完成评论线程时触发。 |
| `comment-select` | `RichTextEditorCommentThread` | 用户点击正文标注或侧边栏评论卡片时触发。 |
| `comment-submit` | `RichTextEditorCommentSubmitPayload` | 新建、回复、编辑评论后都会触发；会带 `content`、`mentions`、`targetUserId`、`targetCommentId` 等通知所需信息。 |
| `comment-mention-search` | `RichTextEditorCommentMentionProviderPayload` | 评论输入框触发 `@` 查询时通知外部；实际返回数据请使用 `commentMentionProvider` 或 `onCommentMentionSearch`。 |
| `comment-mention-item-click` | `RichTextEditorCommentMentionItem` | 用户点击评论 `@` 弹层里的某个用户/文档时触发。 |
| `comment-mention-submit` | `RichTextEditorCommentMentionItem` | 用户确认选择评论 `@` 用户/文档时触发。 |

### 数据保存建议

- 评论锚点是正文内容的一部分，会随 `v-model` JSON 或 Yjs 协同内容保存。
- 评论列表不写入正文 JSON，建议后端按 `documentId + threadId` 独立保存。
- 新建评论时，组件会先给选区写入 `threadId` 标注；业务方收到 `comment-create` 后应保存同一个 `threadId` 并回传到 `comments`。
- 回复某一条评论时，业务方保存回复项时保留 `parentId`，组件会把它展示在被回复评论下面。
- 评论内容里的 `@用户` / `@文档` 以普通文本插入到 `content`，同时会通过 `mentions` 数组把 `{ id, name, type }` 等结构化信息抛出，业务方建议一起保存。
- 评论 `@` 的查询通道与正文提及通道完全独立，接入评论提及时不要复用 `mention-search` 事件。
- 多人协同时，正文锚点跟随 Yjs 同步；评论数据需要业务后端自行广播或刷新。
- `commentUser` 可以不传；组件会优先使用 `commentUser`，没有时回退使用 `collaboration.user`。如果两者都没有，新建评论和回复按钮会禁用。
- 实例方法 `focusCommentThread(threadId): boolean` 可从外部定位到指定评论锚点。
