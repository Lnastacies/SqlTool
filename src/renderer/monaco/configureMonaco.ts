import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

export function configureMonaco(): void {
  // Electron 生产环境禁止加载远程脚本，Monaco 及 Worker 必须随应用本地打包。
  self.MonacoEnvironment = {
    getWorker: () => new EditorWorker(),
  }
  loader.config({ monaco })

  void window.logger?.write(
    'info',
    'Monaco',
    '已配置本地 Monaco 运行时和编辑器 Worker',
  )
}
