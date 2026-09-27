<script setup lang="ts">
import katex from 'katex'
import 'katex/dist/katex.min.css'

import { computed, nextTick, ref, watch } from 'vue'

import ScrollArea from './ScrollArea.vue'
import OfficeIcon from './OfficeIcon.vue'

type FormulaTab = 'common' | 'math' | 'physics' | 'chemistry'
type FormulaPresetMode = 'inline' | 'display'

type FormulaPreset = {
  key: string
  latex: string
  insert?: string
  mode?: FormulaPresetMode
}

const props = withDefaults(
  defineProps<{
    open: boolean
    value?: string
    title?: string
    submitLabel?: string
  }>(),
  {
    value: '',
    title: '插入 LaTeX 公式',
    submitLabel: '插入',
  },
)

const emit = defineEmits<{
  close: []
  submit: [value: string]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const activeTab = ref<FormulaTab>('common')
const draft = ref('')

const presets: Record<FormulaTab, FormulaPreset[]> = {
  common: [
    { key: 'times', latex: '\\times', insert: '\\times ', mode: 'inline' },
    { key: 'div', latex: '\\div', insert: '\\div ', mode: 'inline' },
    { key: 'pm', latex: '\\pm', insert: '\\pm ', mode: 'inline' },
    { key: 'mp', latex: '\\mp', insert: '\\mp ', mode: 'inline' },
    { key: 'cdot', latex: '\\cdot', insert: '\\cdot ', mode: 'inline' },
    { key: 'star', latex: '\\star', insert: '\\star ', mode: 'inline' },
    { key: 'neq', latex: '\\neq', insert: '\\neq ', mode: 'inline' },
    { key: 'leq', latex: '\\leq', insert: '\\leq ', mode: 'inline' },
    { key: 'geq', latex: '\\geq', insert: '\\geq ', mode: 'inline' },
    { key: 'sim', latex: '\\sim', insert: '\\sim ', mode: 'inline' },
    { key: 'approx', latex: '\\approx', insert: '\\approx ', mode: 'inline' },
    { key: 'cong', latex: '\\cong', insert: '\\cong ', mode: 'inline' },
    { key: 'equiv', latex: '\\equiv', insert: '\\equiv ', mode: 'inline' },
    { key: 'propto', latex: '\\propto', insert: '\\propto ', mode: 'inline' },
    { key: 'll', latex: '\\ll', insert: '\\ll ', mode: 'inline' },
    { key: 'gg', latex: '\\gg', insert: '\\gg ', mode: 'inline' },
    { key: 'in', latex: '\\in', insert: '\\in ', mode: 'inline' },
    { key: 'subset', latex: '\\subset', insert: '\\subset ', mode: 'inline' },
    { key: 'supset', latex: '\\supset', insert: '\\supset ', mode: 'inline' },
    { key: 'prec', latex: '\\prec', insert: '\\prec ', mode: 'inline' },
    { key: 'succ', latex: '\\succ', insert: '\\succ ', mode: 'inline' },
    { key: 'preceq', latex: '\\preceq', insert: '\\preceq ', mode: 'inline' },
    { key: 'succeq', latex: '\\succeq', insert: '\\succeq ', mode: 'inline' },
    { key: 'smile', latex: '\\smile', insert: '\\smile ', mode: 'inline' },
    { key: 'frown', latex: '\\frown', insert: '\\frown ', mode: 'inline' },
    { key: 'doteq', latex: '\\doteq', insert: '\\doteq ', mode: 'inline' },
    { key: 'vdash', latex: '\\vdash', insert: '\\vdash ', mode: 'inline' },
    { key: 'dashv', latex: '\\dashv', insert: '\\dashv ', mode: 'inline' },
    { key: 'models', latex: '\\models', insert: '\\models ', mode: 'inline' },
    { key: 'perp', latex: '\\perp', insert: '\\perp ', mode: 'inline' },
    { key: 'parallel', latex: '\\parallel', insert: '\\parallel ', mode: 'inline' },
    { key: 'cap', latex: '\\cap', insert: '\\cap ', mode: 'inline' },
    { key: 'cup', latex: '\\cup', insert: '\\cup ', mode: 'inline' },
    { key: 'bowtie', latex: '\\bowtie', insert: '\\bowtie ', mode: 'inline' },
    { key: 'triangleleft', latex: '\\triangleleft', insert: '\\triangleleft ', mode: 'inline' },
    { key: 'triangleright', latex: '\\triangleright', insert: '\\triangleright ', mode: 'inline' },
    { key: 'sqrt', latex: '\\sqrt{ab}', insert: '\\sqrt{}', mode: 'display' },
    { key: 'rootn', latex: '\\sqrt[n]{ab}', insert: '\\sqrt[]{}', mode: 'display' },
    { key: 'hat', latex: '\\hat{ab}', insert: '\\hat{}', mode: 'display' },
    { key: 'bar', latex: '\\bar{ab}', insert: '\\bar{}', mode: 'display' },
    { key: 'power', latex: 'a^b', insert: '^{}', mode: 'display' },
    { key: 'c_ab', latex: 'c_a^b', insert: 'c_a^b', mode: 'display' },
    { key: 'leftarrow-ab', latex: '\\overleftarrow{ab}', insert: '\\overleftarrow{}', mode: 'display' },
    { key: 'rightarrow-ab', latex: '\\overrightarrow{ab}', insert: '\\overrightarrow{}', mode: 'display' },
    { key: 'overbrace', latex: '\\overbrace{ab}', insert: '\\overbrace{}', mode: 'display' },
    { key: 'overline', latex: '\\overline{ab}', insert: '\\overline{}', mode: 'display' },
    { key: 'underline', latex: '\\underline{ab}', insert: '\\underline{}', mode: 'display' },
    { key: 'plain-ab', latex: 'ab', insert: 'ab', mode: 'display' },
    { key: 'log-base', latex: '\\log_a b', insert: '\\log_{} ', mode: 'display' },
    { key: 'lg', latex: '\\lg ab', insert: '\\lg ', mode: 'display' },
    { key: 'binom', latex: '\\binom{a}{b}', insert: '\\binom{}{}', mode: 'display' },
    {
      key: 'matrix',
      latex: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}',
      insert: '\\begin{bmatrix}  &  \\\\  &  \\end{bmatrix}',
      mode: 'display',
    },
    {
      key: 'cases',
      latex: '\\begin{cases} a & x = 0 \\\\ b & x > 0 \\end{cases}',
      insert: '\\begin{cases}  &  \\\\  &  \\end{cases}',
      mode: 'display',
    },
    { key: 'sin', latex: '\\sin', insert: '\\sin ', mode: 'display' },
    { key: 'cot', latex: '\\cot', insert: '\\cot ', mode: 'display' },
    { key: 'cos', latex: '\\cos', insert: '\\cos ', mode: 'display' },
    { key: 'csc', latex: '\\csc', insert: '\\csc ', mode: 'display' },
    { key: 'sec', latex: '\\sec', insert: '\\sec ', mode: 'display' },
    { key: 'tan', latex: '\\tan', insert: '\\tan ', mode: 'display' },
    { key: 'cosh', latex: '\\cosh', insert: '\\cosh ', mode: 'display' },
    { key: 'coth', latex: '\\coth', insert: '\\coth ', mode: 'display' },
    { key: 'sinh', latex: '\\sinh', insert: '\\sinh ', mode: 'display' },
    { key: 'tanh', latex: '\\tanh', insert: '\\tanh ', mode: 'display' },
    { key: 'arcsin', latex: '\\arcsin', insert: '\\arcsin ', mode: 'display' },
    { key: 'arctan', latex: '\\arctan', insert: '\\arctan ', mode: 'display' },
    { key: 'arccos', latex: '\\arccos', insert: '\\arccos ', mode: 'display' },
    { key: 'log', latex: '\\log', insert: '\\log ', mode: 'display' },
    { key: 'ln', latex: '\\ln', insert: '\\ln ', mode: 'display' },
    { key: 'inf', latex: '\\inf', insert: '\\inf ', mode: 'display' },
    { key: 'lim', latex: '\\lim', insert: '\\lim_{x \\to } ', mode: 'display' },
    { key: 'det', latex: '\\det', insert: '\\det ', mode: 'display' },
    { key: 'ker', latex: '\\ker', insert: '\\ker ', mode: 'display' },
    { key: 'mod', latex: '\\mod', insert: '\\mod ', mode: 'display' },
    { key: 'hom', latex: '\\hom', insert: '\\hom ', mode: 'display' },
    { key: 'gcd', latex: '\\gcd', insert: '\\gcd ', mode: 'display' },
    { key: 'min', latex: '\\min', insert: '\\min ', mode: 'display' },
    { key: 'max', latex: '\\max', insert: '\\max ', mode: 'display' },
    { key: 'exp', latex: '\\exp', insert: '\\exp ', mode: 'display' },
    { key: 'sup', latex: '\\sup', insert: '\\sup ', mode: 'display' },
  ],
  math: [
    {
      key: 'matrix-general',
      latex: 'A_{m\\times n}=\\begin{bmatrix}a_{11}&a_{12}&\\cdots&a_{1n}\\\\a_{21}&a_{22}&\\cdots&a_{2n}\\\\\\vdots&\\vdots&\\ddots&\\vdots\\\\a_{m1}&a_{m2}&\\cdots&a_{mn}\\end{bmatrix}=[a_{ij}]',
    },
    {
      key: 'poly-integer',
      latex: 'a_i\\in\\mathbb{R},\\, n\\in\\mathbb{N} \\\\ y=a_0x^n+a_1x^{n-1}+\\cdots+a_{n-1}x+a_n',
    },
    {
      key: 'binomial-distribution',
      latex: 'P(X=k)=C_n^k p^k(1-p)^{n-k}\\quad (k=1,2,\\cdots,n)',
    },
    {
      key: 'rational-function',
      latex: 'a_i\\in\\mathbb{R},\\, n\\in\\mathbb{N},\\, b_i\\in\\mathbb{R},\\, m\\in\\mathbb{N} \\\\ y=\\frac{a_0x^n+a_1x^{n-1}+\\cdots+a_n}{b_0x^m+b_1x^{m-1}+\\cdots+b_m}',
    },
    {
      key: 'square-matrix',
      latex: 'A_{n\\times n}=\\begin{bmatrix}a_{11}&a_{12}&\\cdots&a_{1n}\\\\a_{21}&a_{22}&\\cdots&a_{2n}\\\\\\vdots&\\vdots&\\ddots&\\vdots\\\\a_{n1}&a_{n2}&\\cdots&a_{nn}\\end{bmatrix}',
    },
    {
      key: 'hyper-distribution',
      latex: 'P(X=k)=\\frac{C_M^k C_{N-M}^{n-k}}{C_N^n}\\quad (k=0,1,2,\\cdots,m,\\, m=\\min\\{M,n\\})',
    },
    {
      key: 'binomial-expectation',
      latex: 'X\\sim B(n,p) \\\\ P(X=k)=C_n^k p^k(1-p)^{n-k}\\quad (k=0,1,2,\\cdots,n) \\\\ EX=np \\\\ DX=np(1-p)',
    },
    {
      key: 'fourier-series',
      latex: 'f(x)=\\frac{a_0}{2}+\\sum_{n=1}^{\\infty}(a_n\\cos nx+b_n\\sin nx)',
    },
    {
      key: 'exp-taylor',
      latex: 'e^x=1+\\frac{x}{1!}+\\frac{x^2}{2!}+\\frac{x^3}{3!}+\\cdots,\\quad -\\infty<x<\\infty',
    },
    {
      key: 'triple-integral',
      latex: '\\iiint_{\\Omega}\\left(\\frac{\\partial P}{\\partial x}+\\frac{\\partial Q}{\\partial y}+\\frac{\\partial R}{\\partial z}\\right)dV=\\iint_{\\partial\\Omega}(P\\cos\\alpha+Q\\cos\\beta+R\\cos\\gamma)dS',
    },
    {
      key: 'riemann-limit',
      latex: '\\lim_{n\\to+\\infty}\\sum_{i=1}^n f\\!\\left[a+\\frac{i}{n}(b-a)\\right]\\frac{b-a}{n}=\\int_a^b f(x)\\,dx',
    },
    {
      key: 'binomial-theorem',
      latex: '(1+x)^n=1+\\frac{nx}{1!}+\\frac{n(n-1)x^2}{2!}+\\cdots',
    },
    {
      key: 'sin-sum-diff',
      latex: '\\sin\\alpha\\pm\\sin\\beta=2\\sin\\frac{1}{2}(\\alpha\\pm\\beta)\\cos\\frac{1}{2}(\\alpha\\mp\\beta)',
    },
    {
      key: 'cos-sum',
      latex: '\\cos\\alpha+\\cos\\beta=2\\cos\\frac{1}{2}(\\alpha+\\beta)\\cos\\frac{1}{2}(\\alpha-\\beta)',
    },
    {
      key: 'euler',
      latex: 'e^{ix}=\\cos x+i\\sin x',
    },
    {
      key: 'green',
      latex: '\\iint_D\\left(\\frac{\\partial Q}{\\partial x}-\\frac{\\partial P}{\\partial y}\\right)dxdy=\\oint_{L}Pdx+Qdy',
    },
    {
      key: 'bernoulli-ode',
      latex: '\\frac{dy}{dx}+P(x)y=Q(x)y^n\\,(n\\neq0,1)',
    },
    {
      key: 'total-differential',
      latex: 'du(x,y)=P(x,y)dx+Q(x,y)dy=0',
    },
  ],
  physics: [
    { key: 'wave-speed', latex: 'c=\\lambda r=\\frac{\\lambda}{T}' },
    { key: 'speed-medium', latex: 'v=\\frac{c}{n}' },
    { key: 'snell', latex: 'n=\\frac{\\sin i}{\\sin r}' },
    { key: 'lens', latex: '\\frac{1}{U}+\\frac{1}{V}=\\frac{1}{f}' },
    { key: 'photoelectric', latex: '\\frac{1}{2}mv_m^2=h\\nu-W' },
    { key: 'pendulum', latex: 'T=2\\pi\\sqrt{\\frac{1}{g}}' },
    { key: 'wave-velocity', latex: 'v=\\frac{\\lambda}{T}=\\lambda r' },
    { key: 'frequency', latex: 'f=\\frac{1}{T}' },
    { key: 'equilibrium', latex: '\\sum \\vec{F}_i=\\frac{d\\vec{v}}{dt}=0' },
    { key: 'newton2', latex: '\\vec{F}=m\\vec{a}=m\\frac{d^2\\vec{r}}{dt^2}' },
    { key: 'newton3', latex: '\\vec{F}_{12}=-\\vec{F}_{21}' },
    { key: 'gravity-potential', latex: 'E_p=-\\frac{GMm}{r}' },
    { key: 'coulomb', latex: '\\vec{F}=k\\frac{Qq}{r^2}\\hat{r}' },
    { key: 'electrostatic-loop', latex: '\\oint_L \\vec{E}\\cdot d\\vec{l}=0' },
    { key: 'biot-savart', latex: 'd\\vec{B}=\\frac{\\mu_0}{4\\pi}\\frac{Id\\vec{l}\\times\\hat{r}}{r^2}=\\frac{\\mu_0}{4\\pi}\\frac{Idl\\sin\\theta}{r^2}' },
    { key: 'ampere-force', latex: 'd\\vec{F}=Id\\vec{l}\\times\\vec{B}' },
    { key: 'induced-emf', latex: 'E=n\\frac{\\Delta\\Phi}{\\Delta t}' },
    { key: 'gauss-electric', latex: '\\Phi_e=\\oint \\vec{E}\\cdot d\\vec{S}=\\frac{1}{\\varepsilon_0}\\sum q' },
    { key: 'faraday', latex: '\\oint \\vec{E}\\cdot d\\vec{l}=-\\frac{d\\varphi_B}{dt}' },
  ],
  chemistry: [
    { key: 'caoh', latex: 'CaO+H_2O=Ca(OH)_2' },
    { key: 'carbonic', latex: 'CO_2+H_2O=H_2CO_3' },
    { key: 'na-oxide', latex: '4Na+O_2=2Na_2O' },
    { key: 'naoh', latex: 'Na_2O+H_2O=2NaOH' },
    { key: 'na2co3', latex: '2Na_2O_2+2CO_2=2Na_2CO_3+O_2' },
    { key: 'hf', latex: 'F_2+H_2=2HF' },
    { key: 'hf-water', latex: '2F_2+2H_2O=4HF+O_2' },
    { key: 'nitric', latex: '3NO_2+H_2O=2HNO_3+NO' },
    { key: 'al-h2so4', latex: '2Al+3H_2SO_4=Al_2(SO_4)_3+3H_2\\uparrow' },
    { key: 'al-hcl', latex: '2Al+6HCl=2AlCl_3+3H_2\\uparrow' },
    { key: 'mg-h2so4', latex: 'Mg+H_2SO_4=MgSO_4+H_2\\uparrow' },
    { key: 'mg-hcl', latex: 'Mg+2HCl=MgCl_2+H_2\\uparrow' },
    { key: 'fe-cuso4', latex: 'Fe+CuSO_4=FeSO_4+Cu' },
    { key: 'fe-h2so4', latex: 'Fe+H_2SO_4=FeSO_4+H_2\\uparrow' },
    { key: 'fe-hcl', latex: 'Fe+2HCl=FeCl_2+H_2\\uparrow' },
    { key: 'zn-h2so4', latex: 'Zn+H_2SO_4=ZnSO_4+H_2\\uparrow' },
    { key: 'zn-hcl', latex: 'Zn+2HCl=ZnCl_2+H_2\\uparrow' },
  ],
}

const tabLabels: Record<FormulaTab, string> = {
  common: '常用符号',
  math: '数学',
  physics: '物理',
  chemistry: '化学',
}

const previewMarkup = computed(() => renderFormulaMarkup(draft.value.trim(), 'display'))
const canSubmit = computed(() => draft.value.trim().length > 0)
const activePresets = computed(() => {
  return presets[activeTab.value].map((item) => ({
    ...item,
    markup: renderFormulaMarkup(item.latex, item.mode ?? (activeTab.value === 'common' ? 'inline' : 'display')),
  }))
})

function renderFormulaMarkup(source: string, mode: FormulaPresetMode) {
  if (!source) {
    return ''
  }

  try {
    return katex.renderToString(source, {
      throwOnError: false,
      displayMode: mode === 'display',
      strict: 'ignore',
    })
  } catch {
    return ''
  }
}

function focusTextarea() {
  void nextTick(() => {
    textareaRef.value?.focus()
  })
}

function closeDialog() {
  emit('close')
}

function submit() {
  if (!canSubmit.value) {
    return
  }

  emit('submit', draft.value.trim())
}

function insertSnippet(snippet: string) {
  const textarea = textareaRef.value
  if (!textarea) {
    draft.value += snippet
    focusTextarea()
    return
  }

  const start = textarea.selectionStart ?? textarea.value.length
  const end = textarea.selectionEnd ?? textarea.value.length
  const nextValue = `${draft.value.slice(0, start)}${snippet}${draft.value.slice(end)}`
  draft.value = nextValue

  void nextTick(() => {
    const cursor = start + snippet.length
    textarea.focus()
    textarea.setSelectionRange(cursor, cursor)
  })
}

function replaceDraftWithPreset(snippet: string) {
  draft.value = snippet

  void nextTick(() => {
    const cursor = snippet.length
    textareaRef.value?.focus()
    textareaRef.value?.setSelectionRange(cursor, cursor)
  })
}

function applyPreset(item: FormulaPreset) {
  const snippet = item.insert ?? item.latex
  if (activeTab.value === 'common') {
    insertSnippet(snippet)
    return
  }

  replaceDraftWithPreset(snippet)
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return
    }

    draft.value = props.value
    activeTab.value = 'common'
    focusTextarea()
  },
)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="norio-office-rich-formula-editor" @click="closeDialog">
      <div class="norio-office-rich-formula-editor__panel" @click.stop>
        <div class="norio-office-rich-formula-editor__header">
          <div class="norio-office-rich-formula-editor__title">{{ title }}</div>
          <button type="button" class="norio-office-rich-formula-editor__close" @click="closeDialog">
            <OfficeIcon name="close" :size="18" color="#6b7280" background-color="transparent" />
          </button>
        </div>

        <div class="norio-office-rich-formula-editor__body">
          <div class="norio-office-rich-formula-editor__left">
            <div class="norio-office-rich-formula-editor__section-title">公式编辑</div>
            <textarea
              ref="textareaRef"
              v-model="draft"
              class="norio-office-rich-formula-editor__textarea"
              placeholder="直接输入，或点击右侧进行快速输入"
            />

            <div class="norio-office-rich-formula-editor__preview">
              <div v-if="previewMarkup" class="norio-office-rich-formula-editor__preview-content" v-html="previewMarkup" />
              <div v-else class="norio-office-rich-formula-editor__preview-placeholder">预览区域</div>
            </div>
          </div>

          <div class="norio-office-rich-formula-editor__right">
            <div class="norio-office-rich-formula-editor__section-title">快速输入</div>
            <div class="norio-office-rich-formula-editor__tabs">
              <button
                type="button"
                class="norio-office-rich-formula-editor__tab"
                :class="{ 'norio-office-rich-formula-editor__tab--active': activeTab === 'common' }"
                @click="activeTab = 'common'"
              >
                {{ tabLabels.common }}
              </button>
              <button
                type="button"
                class="norio-office-rich-formula-editor__tab"
                :class="{ 'norio-office-rich-formula-editor__tab--active': activeTab === 'math' }"
                @click="activeTab = 'math'"
              >
                {{ tabLabels.math }}
              </button>
              <button
                type="button"
                class="norio-office-rich-formula-editor__tab"
                :class="{ 'norio-office-rich-formula-editor__tab--active': activeTab === 'physics' }"
                @click="activeTab = 'physics'"
              >
                {{ tabLabels.physics }}
              </button>
              <button
                type="button"
                class="norio-office-rich-formula-editor__tab"
                :class="{ 'norio-office-rich-formula-editor__tab--active': activeTab === 'chemistry' }"
                @click="activeTab = 'chemistry'"
              >
                {{ tabLabels.chemistry }}
              </button>
            </div>

            <ScrollArea class-name="norio-office-rich-formula-editor__presets-scroll">
              <div
                class="norio-office-rich-formula-editor__presets"
                :class="{
                  'norio-office-rich-formula-editor__presets--common': activeTab === 'common',
                  'norio-office-rich-formula-editor__presets--cards': activeTab !== 'common',
                }"
              >
                <button
                  v-for="item in activePresets"
                  :key="item.key"
                  type="button"
                  class="norio-office-rich-formula-editor__preset"
                  :class="{
                    'norio-office-rich-formula-editor__preset--inline': activeTab === 'common' && (item.mode ?? 'inline') === 'inline',
                    'norio-office-rich-formula-editor__preset--block': activeTab !== 'common' || item.mode === 'display',
                  }"
                  @click="applyPreset(item)"
                >
                  <span class="norio-office-rich-formula-editor__preset-preview" v-html="item.markup" />
                </button>
              </div>
            </ScrollArea>
          </div>
        </div>

        <div class="norio-office-rich-formula-editor__footer">
          <div class="norio-office-rich-formula-editor__hint">使用 LaTeX 语法编辑公式</div>
          <div class="norio-office-rich-formula-editor__actions">
            <button type="button" class="norio-office-rich-formula-editor__button norio-office-rich-formula-editor__button--secondary" @click="closeDialog">
              取消
            </button>
            <button
              type="button"
              class="norio-office-rich-formula-editor__button norio-office-rich-formula-editor__button--primary"
              :disabled="!canSubmit"
              @click="submit"
            >
              {{ submitLabel }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
