import { dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../logger'

export interface ExportQueryResultCsvRequest {
  /** 保存对话框中建议使用的文件名（不含路径） */
  suggestedName?: string
  /** 已在渲染进程生成好的 CSV 文本内容 */
  content: string
}

export interface ExportQueryResultCsvResult {
  cancelled: boolean
  filePath?: string
}

/** 文件名中的非法字符替换为下划线，并截断到安全长度 */
function safeFileStem(name: string): string {
  const normalized = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[.\s]+$/g, '')
    .slice(0, 120)
  return normalized || 'query-result'
}

export class ResultExportService {
  /**
   * 导出查询结果 CSV：
   * 弹出系统保存对话框（仅允许 .csv），追加 UTF-8 BOM 以便 Excel 正确识别中文，
   * 最后将渲染进程生成的 CSV 内容写入磁盘。
   */
  async exportCsv(
    request: ExportQueryResultCsvRequest,
  ): Promise<ExportQueryResultCsvResult> {
    if (typeof request.content !== 'string' || request.content.length === 0) {
      throw new Error('查询结果导出内容为空')
    }

    const suggestedName = request.suggestedName?.trim() || '查询结果.csv'
    const defaultPath = path.extname(suggestedName)
      ? suggestedName
      : `${suggestedName}.csv`

    logger.info('ResultExport', `打开查询结果保存窗口: 默认文件=${defaultPath}`)
    const selection = await dialog.showSaveDialog({
      title: '导出查询结果',
      defaultPath,
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
    })
    if (selection.canceled || !selection.filePath) {
      logger.info('ResultExport', '用户取消导出查询结果')
      return { cancelled: true }
    }

    // 未填扩展名时补 .csv
    let targetPath = selection.filePath
    if (!path.extname(targetPath)) {
      targetPath = `${targetPath}.csv`
    }

    try {
      // \uFEFF 为 UTF-8 BOM，Excel 打开时可正确识别中文
      await fs.promises.writeFile(targetPath, `\uFEFF${request.content}`, 'utf8')
      logger.info(
        'ResultExport',
        `查询结果导出完成: 文件=${path.basename(targetPath)}, 字节=${Buffer.byteLength(request.content, 'utf8')}`,
      )
      return { cancelled: false, filePath: targetPath }
    } catch (error) {
      logger.error(
        'ResultExport',
        `查询结果导出失败: 文件=${path.basename(targetPath)}`,
        error instanceof Error ? error : undefined,
      )
      throw error
    }
  }
}
