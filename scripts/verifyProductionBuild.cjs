const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const distDirectory = path.join(projectRoot, 'dist')
const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
)
const violations = []
const requiredFiles = [
  'dist/main/index.js',
  'dist/main/preload.js',
  'dist/renderer/index.html',
]

const forbiddenFiles = [
  /(^|\/)connections\.json$/i,
  /(^|\/)query_history\.json$/i,
  /(^|\/)snippets\.json$/i,
  /(^|\/)encryption\.key$/i,
  /(^|\/)logs?\//i,
  /(^|\/)\.dbg\//i,
  /\.log$/i,
  /\.map$/i,
]
const forbiddenContent = [
  '127.0.0.1:7777',
  '127.0.0.1:7778',
  'sqltool:debug-',
  'debug-new-query-routing',
  'startup-modal-mask',
  'sourceMappingURL=data:application/json',
]
const textExtensions = new Set(['.css', '.html', '.js', '.json'])

function collectFiles(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

if (!fs.existsSync(distDirectory)) {
  violations.push('缺少 dist 生产构建目录')
} else {
  for (const relativePath of requiredFiles) {
    if (!fs.existsSync(path.join(projectRoot, relativePath))) {
      violations.push(`缺少生产构建入口: ${relativePath}`)
    }
  }

  for (const filePath of collectFiles(distDirectory)) {
    const relativePath = path
      .relative(projectRoot, filePath)
      .replaceAll(path.sep, '/')
    if (forbiddenFiles.some(pattern => pattern.test(relativePath))) {
      violations.push(`禁止打包的文件: ${relativePath}`)
      continue
    }
    if (!textExtensions.has(path.extname(filePath).toLowerCase())) continue

    const content = fs.readFileSync(filePath, 'utf8')
    for (const marker of forbiddenContent) {
      if (content.includes(marker)) {
        violations.push(`调试标记 ${marker}: ${relativePath}`)
      }
    }
  }
}

const packagedFiles = packageJson.build?.files || []
if (
  packagedFiles.length !== 1
  || packagedFiles[0] !== 'dist/**/*'
) {
  violations.push(
    `打包白名单必须仅包含 dist/**/*，当前为: ${packagedFiles.join(', ')}`,
  )
}

if (violations.length > 0) {
  console.error('[生产构建守卫] 检查失败:')
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

const fileCount = fs.existsSync(distDirectory)
  ? collectFiles(distDirectory).length
  : 0
console.log(
  `[生产构建守卫] 检查通过: 构建文件=${fileCount}, 未发现会话配置、日志、source map 或调试接口`,
)
