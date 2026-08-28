const path = require('path')
const { removeBuildDirectory } = require('./buildDirectoryCleaner.cjs')

const projectRoot = path.resolve(__dirname, '..')
const distDirectory = path.join(projectRoot, 'dist')

console.log(`[生产构建清理] 开始清理目录: ${distDirectory}`)
try {
  removeBuildDirectory(distDirectory, () => {
    console.warn('[生产构建清理] fs.rmSync 未完成清理，切换逐项删除')
  })
} catch (error) {
  console.error(
    `[生产构建清理] 清理失败: ${
      error instanceof Error ? error.message : String(error)
    }`,
  )
  process.exitCode = 1
} finally {
  if (!process.exitCode) console.log('[生产构建清理] 清理完成')
}
