const fs = require('fs')

function removeEntry(targetPath) {
  const stat = fs.lstatSync(targetPath)
  if (stat.isDirectory() && !stat.isSymbolicLink()) {
    for (const entry of fs.readdirSync(targetPath)) {
      removeEntry(require('path').join(targetPath, entry))
    }
    fs.rmdirSync(targetPath)
    return
  }
  fs.unlinkSync(targetPath)
}

function removeBuildDirectory(directoryPath, onFallback = () => undefined) {
  if (!fs.existsSync(directoryPath)) return

  try {
    fs.rmSync(directoryPath, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 200,
    })
  } catch (error) {
    // 统一在目录复查后决定是否降级，保留原生清理的重试能力。
  }

  if (fs.existsSync(directoryPath)) {
    onFallback()
    removeEntry(directoryPath)
  }

  if (fs.existsSync(directoryPath)) {
    throw new Error(`构建目录清理失败: ${directoryPath}`)
  }
}

module.exports = { removeBuildDirectory }
