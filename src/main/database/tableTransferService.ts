import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../logger'
import type { TableDatabaseType } from './tableStructureTypes'
import { selectTableExportTargets } from './tableTransferDestination'
import {
  parseExcelImportFile,
  writeExcelExport,
} from './tableTransferExcel'
import {
  decodeTextBuffer,
  detectTextEncoding,
  encodeTextChunk,
} from './tableTransferFileEncoding'
import {
  exportEpilogue,
  exportPreamble,
  exportRowsChunk,
  parseTableImportContent,
} from './tableTransferFormat'
import { tableImportFormatFromExtension } from './tableTransferImportFormat'
import { normalizedTextOptions } from './tableTransferText'
import {
  MAX_TABLE_IMPORT_BYTES,
  MAX_TABLE_IMPORT_ROWS,
  TABLE_EXPORT_PAGE_SIZE,
  type TableExportFormat,
  type TableExportOptions,
  type TableExportResult,
  type TableImportOptions,
  type TableImportPreview,
  type TableTextFormatOptions,
} from './tableTransferTypes'

interface TableExportSource {
  totalRows: number
  loadPage: (
    page: number,
    pageSize: number,
  ) => Promise<Record<string, unknown>[]>
}

export async function openTableImportFile(): Promise<TableImportPreview> {
  logger.info('TableTransfer', '打开数据导入文件选择窗口')
  const { dialog } = await import('electron')
  const selection = await dialog.showOpenDialog({
    title: '选择表数据文件',
    properties: ['openFile'],
    filters: [
      { name: '支持的数据文件', extensions: ['txt', 'csv', 'json', 'xml', 'xlsx'] },
      { name: '文本文件', extensions: ['txt', 'csv'] },
      { name: 'Excel 工作簿', extensions: ['xlsx'] },
      { name: 'CSV 文件', extensions: ['csv'] },
      { name: 'JSON 文件', extensions: ['json'] },
      { name: 'XML 文件', extensions: ['xml'] },
    ],
  })
  if (selection.canceled || selection.filePaths.length === 0) {
    logger.info('TableTransfer', '用户取消选择导入文件')
    return { cancelled: true, columns: [], rows: [], totalRows: 0 }
  }
  return parseTableImportFile(selection.filePaths[0])
}

function defaultTextOptions(
  format: 'txt' | 'csv',
  encoding: TableTextFormatOptions['encoding'],
): TableTextFormatOptions {
  return normalizedTextOptions({
    delimiter: format === 'txt' ? '\t' : ',',
    encoding,
  })
}

export async function parseTableImportFile(
  filePath: string,
  requestedOptions?: TableImportOptions,
): Promise<TableImportPreview> {
  const stat = await fs.promises.stat(filePath)
  if (stat.size > MAX_TABLE_IMPORT_BYTES) {
    throw new Error('导入文件不能超过 20 MB')
  }

  const format = tableImportFormatFromExtension(path.extname(filePath))
  if (requestedOptions && requestedOptions.format !== format) {
    throw new Error(`文件扩展名与导入格式不一致: 文件=${format}, 请求=${requestedOptions.format}`)
  }
  logger.info(
    'TableTransfer',
    `开始解析导入文件: 文件=${path.basename(filePath)}, 格式=${format.toUpperCase()}, 大小=${stat.size}字节`,
  )

  const parsed = format === 'xlsx'
    ? await parseExcelImportFile(filePath)
    : await parseTextImportFile(filePath, format, requestedOptions)
  if (parsed.totalRows > MAX_TABLE_IMPORT_ROWS) {
    throw new Error(`单次最多导入 ${MAX_TABLE_IMPORT_ROWS} 行数据`)
  }
  const result = {
    cancelled: false,
    filePath,
    fileName: path.basename(filePath),
    ...parsed,
  }
  logger.info(
    'TableTransfer',
    `导入文件解析完成: 文件=${result.fileName}, 格式=${format.toUpperCase()}, 工作表=${result.sheetName || '无'}, 字段=${result.columns.length}, 数据行=${result.totalRows}`,
  )
  return result
}

async function parseTextImportFile(
  filePath: string,
  format: Exclude<TableImportOptions['format'], 'xlsx'>,
  requestedOptions?: TableImportOptions,
): Promise<Omit<TableImportPreview, 'cancelled' | 'filePath' | 'fileName'>> {
  const buffer = await fs.promises.readFile(filePath)
  const detectedEncoding = detectTextEncoding(buffer)
  const textOptions = format === 'txt' || format === 'csv'
    ? requestedOptions?.text || defaultTextOptions(format, detectedEncoding)
    : undefined
  const encoding = textOptions?.encoding || detectedEncoding
  const content = decodeTextBuffer(buffer, encoding)
  logger.info(
    'TableTransfer',
    `按文本格式解析导入文件: 文件=${path.basename(filePath)}, 格式=${format.toUpperCase()}, 编码=${encoding}, 分隔符=${textOptions ? JSON.stringify(textOptions.delimiter) : '不适用'}, 包含标题=${textOptions ? (textOptions.includeHeader ? '是' : '否') : '不适用'}`,
  )
  return parseTableImportContent(`.${format}`, content, textOptions)
}

function temporaryPath(filePath: string): string {
  return path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isMissingFileError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT'
}

export async function replaceExportFile(
  pendingPath: string,
  outputPath: string,
): Promise<void> {
  const backupPath = `${pendingPath}.backup`
  let hasBackup = false

  try {
    await fs.promises.rename(outputPath, backupPath)
    hasBackup = true
  } catch (error) {
    if (!isMissingFileError(error)) throw error
  }

  try {
    await fs.promises.rename(pendingPath, outputPath)
  } catch (replacementError) {
    if (hasBackup) {
      try {
        await fs.promises.rename(backupPath, outputPath)
        logger.warn(
          'TableTransfer',
          `导出文件替换失败，已恢复原文件: ${path.basename(outputPath)}`,
        )
      } catch (restoreError) {
        throw new Error(
          `导出文件替换失败且原文件恢复失败: 替换=${errorMessage(replacementError)}; 恢复=${errorMessage(restoreError)}`,
        )
      }
    }
    throw replacementError
  }

  if (hasBackup) {
    await fs.promises.rm(backupPath, { force: true }).catch(error => {
      logger.warn(
        'TableTransfer',
        `导出完成但旧文件备份清理失败: 文件=${path.basename(backupPath)}, 原因=${errorMessage(error)}`,
      )
    })
  }
}

export async function writeTableExportFile(
  databaseType: TableDatabaseType,
  tableName: string,
  columns: string[],
  format: TableExportFormat,
  source: TableExportSource,
  requestedOptions?: Partial<TableExportOptions>,
): Promise<TableExportResult> {
  const targets = await selectTableExportTargets([tableName], format)
  if (!targets) return { cancelled: true, rowCount: 0 }
  const outputPath = targets[0].filePath
  const rowCount = await writeTableExportToPath(
    databaseType,
    tableName,
    columns,
    {
      format,
      columns,
      binaryEncoding: requestedOptions?.binaryEncoding || 'base64',
      ...requestedOptions,
    },
    source,
    outputPath,
  )
  return { cancelled: false, filePath: outputPath, rowCount }
}

export async function writeTableExportToPath(
  databaseType: TableDatabaseType,
  tableName: string,
  columns: string[],
  options: TableExportOptions,
  source: TableExportSource,
  outputPath: string,
): Promise<number> {
  const pendingPath = temporaryPath(outputPath)
  logger.info(
    'TableTransfer',
    `开始写入导出文件: 对象=${tableName}, 格式=${options.format.toUpperCase()}, 字段=${columns.length}, 预计行数=${source.totalRows}, 文件=${path.basename(outputPath)}`,
  )
  if (options.format === 'xlsx') {
    try {
      const rowCount = await writeExcelExport(
        pendingPath,
        tableName,
        columns,
        source,
        options,
      )
      await replaceExportFile(pendingPath, outputPath)
      logger.info(
        'TableTransfer',
        `Excel 导出文件写入完成: 对象=${tableName}, 行数=${rowCount}, 文件=${path.basename(outputPath)}`,
      )
      return rowCount
    } catch (error) {
      await fs.promises.rm(pendingPath, { force: true }).catch(() => undefined)
      throw error
    }
  }

  let handle: fs.promises.FileHandle | undefined
  let rowCount = 0
  let firstChunk = true
  const encoding = options.format === 'csv' || options.format === 'txt'
    ? normalizedTextOptions(options.text).encoding
    : 'utf8'
  try {
    handle = await fs.promises.open(pendingPath, 'w')
    const writeChunk = async (content: string) => {
      if (!handle) throw new Error('导出文件句柄已关闭')
      await handle.write(encodeTextChunk(content, encoding, firstChunk))
      firstChunk = false
    }
    await writeChunk(exportPreamble(
      options.format,
      columns,
      options,
      databaseType,
    ))
    const pageCount = Math.ceil(source.totalRows / TABLE_EXPORT_PAGE_SIZE)
    for (let page = 1; page <= pageCount; page += 1) {
      const rows = await source.loadPage(page, TABLE_EXPORT_PAGE_SIZE)
      await writeChunk(exportRowsChunk(
        databaseType,
        tableName,
        columns,
        rows,
        options.format,
        rowCount,
        options,
      ))
      rowCount += rows.length
      if (rows.length < TABLE_EXPORT_PAGE_SIZE) break
    }
    await writeChunk(exportEpilogue(
      options.format,
      tableName,
      rowCount,
      options,
    ))
    await handle.close()
    handle = undefined

    // Windows 不支持 rename 直接覆盖目标文件，先备份旧文件以便替换失败时恢复。
    await replaceExportFile(pendingPath, outputPath)
    logger.info(
      'TableTransfer',
      `导出文件写入完成: 对象=${tableName}, 格式=${options.format.toUpperCase()}, 行数=${rowCount}, 编码=${encoding}, 文件=${path.basename(outputPath)}`,
    )
    return rowCount
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined)
    await fs.promises.rm(pendingPath, { force: true }).catch(() => undefined)
    throw error
  }
}
