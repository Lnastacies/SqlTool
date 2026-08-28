import { dialog } from 'electron'
import * as path from 'path'
import type { TableExportFormat } from './tableTransferTypes'

export interface TableExportTarget {
  objectName: string
  filePath: string
}

function safeFileStem(name: string): string {
  const normalized = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[.\s]+$/g, '')
    .slice(0, 120)
  return normalized || 'data'
}

function uniqueFileStem(name: string, used: Set<string>): string {
  const base = safeFileStem(name)
  let candidate = base
  let suffix = 2
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}_${suffix}`
    suffix += 1
  }
  used.add(candidate.toLowerCase())
  return candidate
}

export async function selectTableExportTargets(
  objectNames: string[],
  format: TableExportFormat,
): Promise<TableExportTarget[] | null> {
  if (objectNames.length === 1) {
    const selection = await dialog.showSaveDialog({
      title: '导出数据',
      defaultPath: `${safeFileStem(objectNames[0])}.${format}`,
      filters: [{
        name: `${format.toUpperCase()} 文件`,
        extensions: [format],
      }],
    })
    if (selection.canceled || !selection.filePath) return null
    return [{ objectName: objectNames[0], filePath: selection.filePath }]
  }

  const selection = await dialog.showOpenDialog({
    title: `选择 ${objectNames.length} 个导出文件的保存目录`,
    properties: ['openDirectory', 'createDirectory'],
  })
  if (selection.canceled || selection.filePaths.length === 0) return null

  const directoryPath = selection.filePaths[0]
  const used = new Set<string>()
  return objectNames.map(objectName => ({
    objectName,
    filePath: path.join(
      directoryPath,
      `${uniqueFileStem(objectName, used)}.${format}`,
    ),
  }))
}
