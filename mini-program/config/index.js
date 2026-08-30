const fs = require('fs')
const path = require('path')

// 读取项目根目录 .env 里的 VITE_ 变量作为小程序 Supabase 配置
const rootEnvPath = path.resolve(__dirname, '..', '..', '.env')
const env = {}
if (fs.existsSync(rootEnvPath)) {
  fs.readFileSync(rootEnvPath, 'utf-8').split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2]
  })
}

const SUPABASE_URL = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://eavkjpsqxgrcjcfrhodx.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gd0qrPYJZg4EU63ME3Z3Eg_sF2VMR8K'

const config = {
  projectName: 'exam-prep-mini',
  date: '2026-8-30',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {
    'process.env.SUPABASE_URL': JSON.stringify(SUPABASE_URL),
    'process.env.SUPABASE_ANON_KEY': JSON.stringify(SUPABASE_ANON_KEY),
  },
  alias: {
    '@': path.resolve(__dirname, '..', 'src'),
  },
  copy: {
    patterns: [],
    options: {},
  },
  framework: 'react',
  compiler: 'webpack5',
  cache: {
    enable: true,
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    esnextModules: ['@nutui/nutui-react'],
    postcss: {
      autoprefixer: {
        enable: true,
        config: {},
      },
    },
  },
}

module.exports = function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'))
  }
  return merge({}, config, require('./prod'))
}
