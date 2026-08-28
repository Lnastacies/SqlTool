const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const logPrefix = '[Electron 启动检查]'

function resolveElectronDirectory() {
  try {
    const packagePath = require.resolve('electron/package.json', {
      paths: [projectRoot],
    })
    return path.dirname(packagePath)
  } catch (error) {
    throw new Error(
      `未找到 Electron 依赖，请先执行 npm install。原始错误: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

function ensureElectronRuntime() {
  const electronDirectory = resolveElectronDirectory()
  const pathFile = path.join(electronDirectory, 'path.txt')
  if (!fs.existsSync(pathFile)) {
    throw new Error(`缺少 Electron 路径文件: ${pathFile}`)
  }

  const originalExecutableName = fs.readFileSync(pathFile, 'utf8')
  const executableName = originalExecutableName.trim()
  if (!executableName) {
    throw new Error(`Electron 路径文件内容为空: ${pathFile}`)
  }

  // Electron 28 不会清理 path.txt 中的换行符，需在启动前修正异常安装状态。
  if (originalExecutableName !== executableName) {
    fs.writeFileSync(pathFile, executableName, 'utf8')
    console.warn(
      `${logPrefix} 检测到可执行文件路径包含首尾空白，已修正为: ${executableName}`,
    )
  }

  const distDirectory =
    process.env.ELECTRON_OVERRIDE_DIST_PATH
    || path.join(electronDirectory, 'dist')
  const executablePath = path.join(distDirectory, executableName)
  if (!fs.existsSync(executablePath)) {
    throw new Error(`Electron 可执行文件不存在: ${executablePath}`)
  }

  console.log(`${logPrefix} 检查通过: ${executablePath}`)
}

try {
  ensureElectronRuntime()
} catch (error) {
  console.error(
    `${logPrefix} 检查失败: ${
      error instanceof Error ? error.message : String(error)
    }`,
  )
  process.exit(1)
}
