/**
 * 简易 LaTeX 清洗：去掉 $ 包裹，把常见数学符号转成 Unicode。
 * 小程序里不引入 KaTeX，保证体积和兼容性。
 */

const greekMap: Record<string, string> = {
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
  '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
  '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
  '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ',
  '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
  '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
}

const opMap: Record<string, string> = {
  '\\times': '×', '\\cdot': '·', '\\div': '÷', '\\pm': '±',
  '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\approx': '≈',
  '\\infty': '∞', '\\sqrt': '√', '\\sum': '∑', '\\prod': '∏',
  '\\int': '∫', '\\in': '∈', '\\notin': '∉', '\\subset': '⊂',
  '\\cup': '∪', '\\cap': '∩', '\\emptyset': '∅',
  '\\Rightarrow': '⇒', '\\rightarrow': '→', '\\leftarrow': '←',
  '\\frac': '/', '\\left': '', '\\right': '', '\\{': '{', '\\}': '}',
  '\\^': '^', '\\_': '_', '\\': ' ',
}

export function cleanMath(text: string): string {
  if (!text) return ''
  let s = String(text)
  // 去掉 $$...$$ 和 $...$ 包裹
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, '$1').replace(/\$([\s\S]*?)\$/g, '$1')
  // 替换希腊字母
  Object.keys(greekMap).forEach((k) => {
    s = s.split(k).join(greekMap[k])
  })
  // 替换运算/关系符号
  Object.keys(opMap).forEach((k) => {
    s = s.split(k).join(opMap[k])
  })
  // 处理 frac{a}{b} -> a/b
  s = s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '$1/$2')
  // 处理 ^{...} -> ^...
  s = s.replace(/\^\{([^{}]+)\}/g, '^$1')
  s = s.replace(/_\{([^{}]+)\}/g, '_$1')
  // 去掉多余空格
  s = s.replace(/\s+/g, ' ').trim()
  return s
}
