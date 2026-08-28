const path = require('path')
const { removeBuildDirectory } = require('./buildDirectoryCleaner.cjs')

const rendererDirectory = path.resolve(__dirname, '..', 'dist', 'renderer')

console.log(`[渲染构建清理] 开始清理目录: ${rendererDirectory}`)
try {
  removeBuildDirectory(rendererDirectory, () => {
    console.warn('[渲染构建清理] fs.rmSync 未完成清理，切换逐项删除')
  })
  console.log('[渲染构建清理] 清理完成')
} catch (error) {
  console.error(
    `[渲染构建清理] 清理失败: ${
      error instanceof Error ? error.message : String(error)
    }`,
  )
  process.exitCode = 1
}
