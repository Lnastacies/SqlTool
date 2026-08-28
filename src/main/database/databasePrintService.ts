import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../logger'
import type {
  DatabaseModel,
  DatabasePrintResult,
} from './databaseManagementTypes'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildDatabasePrintHtml(model: DatabaseModel): string {
  const tables = model.tables.map(table => {
    const fields = table.fields.map(field => `
      <tr>
        <td>${escapeHtml(field.name)}</td>
        <td>${escapeHtml(field.type)}</td>
        <td>${field.primary ? '是' : ''}</td>
        <td>${field.not_null ? '否' : '是'}</td>
        <td>${escapeHtml(field.default_expression ?? field.default ?? '')}</td>
        <td>${escapeHtml(field.comment)}</td>
      </tr>`).join('')
    return `
      <section>
        <h2>${escapeHtml(table.name)}</h2>
        <table>
          <thead><tr><th>字段</th><th>类型</th><th>主键</th><th>允许空</th><th>默认值</th><th>注释</th></tr></thead>
          <tbody>${fields || '<tr><td colspan="6">未读取到字段</td></tr>'}</tbody>
        </table>
      </section>`
  }).join('')

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(model.name)} - 数据库结构</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { color: #1f2937; font: 12px/1.5 "Microsoft YaHei", sans-serif; }
    h1 { margin: 0 0 6px; font-size: 22px; }
    .summary { margin-bottom: 18px; color: #64748b; }
    section { break-inside: avoid; margin: 0 0 20px; }
    h2 { margin: 0 0 6px; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { padding: 5px 7px; border: 1px solid #cbd5e1; text-align: left; word-break: break-all; }
    th { background: #f1f5f9; }
  </style>
</head>
<body>
  <h1>数据库结构：${escapeHtml(model.name)}</h1>
  <div class="summary">类型：${escapeHtml(model.type)}　表：${model.tables.length}　视图：${model.views.length}　函数：${model.functions.length}　存储过程：${model.procedures.length}</div>
  ${tables || '<p>该数据库没有可打印的数据表。</p>'}
</body>
</html>`
}

export async function printDatabaseModel(
  model: DatabaseModel,
  parent: BrowserWindow | null,
  temporaryDirectory: string,
): Promise<DatabasePrintResult> {
  const filePath = path.join(
    temporaryDirectory,
    `sqltool-database-${process.pid}-${Date.now()}.html`,
  )
  const printWindow = new BrowserWindow({
    show: false,
    parent: parent || undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  try {
    await fs.promises.writeFile(
      filePath,
      buildDatabasePrintHtml(model),
      'utf8',
    )
    await printWindow.loadFile(filePath)
    logger.info(
      'DatabasePrint',
      `打开数据库打印窗口: 数据库=${model.name}, 表=${model.tables.length}`,
    )
    const cancelled = await new Promise<boolean>((resolve, reject) => {
      printWindow.webContents.print(
        { silent: false, printBackground: true },
        (success, failureReason) => {
          if (success) {
            resolve(false)
            return
          }
          if (/cancel/i.test(failureReason || '')) {
            resolve(true)
            return
          }
          reject(new Error(failureReason || '数据库打印失败'))
        },
      )
    })
    logger.info(
      'DatabasePrint',
      `${cancelled ? '取消' : '完成'}数据库打印: 数据库=${model.name}`,
    )
    return { cancelled, tableCount: model.tables.length }
  } catch (error) {
    logger.error(
      'DatabasePrint',
      `数据库打印失败: 数据库=${model.name}, 原因=${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
    )
    throw error
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy()
    await fs.promises.rm(filePath, { force: true }).catch(() => undefined)
  }
}
