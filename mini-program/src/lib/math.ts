/**
 * 彻底清洗 LaTeX 数学公式，转成 Unicode 可读文本。
 * 覆盖上下标、根号、分式、常见符号，避免小程序里出现 ^ _ 等残留。
 */

const greekMap: Record<string, string> = {
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
  '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
  '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
  '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ',
  '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
  '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
  '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
  '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Phi': 'Φ',
  '\\Psi': 'Ψ', '\\Omega': 'Ω',
}

const symbolMap: Record<string, string> = {
  '\\times': '×', '\\cdot': '·', '\\div': '÷', '\\pm': '±',
  '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\approx': '≈',
  '\\infty': '∞', '\\sum': '∑', '\\prod': '∏', '\\int': '∫',
  '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\subseteq': '⊆',
  '\\cup': '∪', '\\cap': '∩', '\\emptyset': '∅',
  '\\Rightarrow': '⇒', '\\rightarrow': '→', '\\leftarrow': '←',
  '\\Leftrightarrow': '⇔', '\\leftrightarrow': '↔',
  '\\forall': '∀', '\\exists': '∃', '\\nabla': '∇', '\\partial': '∂',
  '\\sin': 'sin', '\\cos': 'cos', '\\tan': 'tan', '\\cot': 'cot',
  '\\sec': 'sec', '\\csc': 'csc', '\\log': 'log', '\\ln': 'ln',
  '\\lim': 'lim', '\\max': 'max', '\\min': 'min',
  '\\left': '', '\\right': '', '\\{': '{', '\\}': '}',
}

const superscriptMap: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
  'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ',
  'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
  'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
  'A': 'ᴬ', 'B': 'ᴮ', 'C': 'ᶜ', 'D': 'ᴰ', 'E': 'ᴱ',
  'F': 'ᶠ', 'G': 'ᴳ', 'H': 'ᴴ', 'I': 'ᴵ', 'J': 'ᴶ',
  'K': 'ᴷ', 'L': 'ᴸ', 'M': 'ᴹ', 'N': 'ᴺ', 'O': 'ᴼ',
  'P': 'ᴾ', 'R': 'ᴿ', 'S': 'ˢ', 'T': 'ᵀ', 'U': 'ᵁ',
  'V': 'ⱽ', 'W': 'ᵂ', 'X': 'ˣ', 'Y': 'ʸ', 'Z': 'ᶻ',
}

const subscriptMap: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ',
}

function toSuperscript(text: string): string {
  return text.split('').map((c) => superscriptMap[c] || c).join('')
}

function toSubscript(text: string): string {
  return text.split('').map((c) => subscriptMap[c] || c).join('')
}

function processBraces(input: string, pattern: RegExp, transform: (s: string) => string): string {
  let result = ''
  let lastIndex = 0
  let match: RegExpExecArray | null
  const re = new RegExp(pattern.source, pattern.flags)
  while ((match = re.exec(input)) !== null) {
    result += input.slice(lastIndex, match.index)
    result += transform(match[1] ?? '')
    lastIndex = re.lastIndex
  }
  result += input.slice(lastIndex)
  return result
}

export function cleanMath(text: string): string {
  if (!text) return ''
  let s = String(text)

  // 去掉 $$...$$ 和 $...$ 包裹
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, '$1').replace(/\$([\s\S]*?)\$/g, '$1')

  // 替换希腊字母和符号
  Object.keys(greekMap).forEach((k) => {
    s = s.split(k).join(greekMap[k])
  })
  Object.keys(symbolMap).forEach((k) => {
    s = s.split(k).join(symbolMap[k])
  })

  // 处理分式 \frac{a}{b} -> a⁄b
  s = s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '$1⁄$2')
  s = s.replace(/\\dfrac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '$1⁄$2')
  s = s.replace(/\\tfrac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '$1⁄$2')

  // 处理根号 \sqrt{x} -> √(x)；\sqrt[n]{x} -> ⁿ√(x)
  s = s.replace(/\\sqrt\s*\{([^{}]+)\}/g, '√($1)')
  s = s.replace(/\\sqrt\s*\[([^\]]+)\]\s*\{([^{}]+)\}/g, (_, n, x) => `${toSuperscript(n)}√(${x})`)

  // 处理上标 ^{...} -> 上标
  s = processBraces(s, /\^\{([^{}]+)\}/, toSuperscript)
  // 处理单个字符上标 ^x
  s = s.replace(/\^([a-zA-Z0-9+\-=()])/g, (_, c) => toSuperscript(c))

  // 处理下标 _{...} -> 下标
  s = processBraces(s, /_\{([^{}]+)\}/, toSubscript)
  // 处理单个字符下标 _x
  s = s.replace(/_([a-zA-Z0-9+\-=()])/g, (_, c) => toSubscript(c))

  // 处理 \binom{n}{k} -> C(n,k)
  s = s.replace(/\\binom\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, 'C($1,$2)')
  s = s.replace(/\\dbinom\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, 'C($1,$2)')

  // 处理 \sum_{i=1}^{n} -> ∑ᵢ₌₁ⁿ
  s = s.replace(/\\sum\s*_\{([^{}]+)\}\s*\^\{([^{}]+)\}/g, (_, lo, hi) => `∑${toSubscript(lo)}${toSuperscript(hi)}`)
  s = s.replace(/\\sum\s*_\{([^{}]+)\}/g, (_, lo) => `∑${toSubscript(lo)}`)
  s = s.replace(/\\sum\s*\^\{([^{}]+)\}/g, (_, hi) => `∑${toSuperscript(hi)}`)

  // 处理 \int_{a}^{b} -> ∫ₐᵇ
  s = s.replace(/\\int\s*_\{([^{}]+)\}\s*\^\{([^{}]+)\}/g, (_, lo, hi) => `∫${toSubscript(lo)}${toSuperscript(hi)}`)
  s = s.replace(/\\int\s*_\{([^{}]+)\}/g, (_, lo) => `∫${toSubscript(lo)}`)
  s = s.replace(/\\int\s*\^\{([^{}]+)\}/g, (_, hi) => `∫${toSuperscript(hi)}`)

  // 处理 \to 在 \lim 之前，确保极限里的箭头先转换
  s = s.replace(/\\to/g, '→')
  // 处理 \lim_{x→a} -> lim(x→a)
  s = s.replace(/\\lim\s*_\{([^{}]+)\}/g, (_, x) => `lim(${x})`)

  // 去掉多余空格
  s = s.replace(/\s+/g, ' ').trim()
  return s
}
