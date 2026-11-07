import { dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../logger'
import { buildStructureResetSql } from './databaseDumpSql'
import {
  replaceExportFile,
} from './tableTransferService'
import {
  buildDropObjectSql,
  foreignKeyGuardSql,
  formatObjectDdl,
} from './databaseBackupSql'
import {
  backupInsertRowsSql,
  backupTableDataSql,
} from './databaseBackupDataSql'
import {
  buildDatabaseBackupTableSql,
} from './databaseBackupTableSql'
import type {
  DatabaseBackupObjectDdl,
  DatabaseBackupProgress,
} from './databaseBackupTypes'
import type {
  DatabaseDumpMode,
  DatabaseDumpResult,
  DatabaseModel,
  DatabaseModelTable,
} from './databaseManagementTypes'

// 备份/转储的表数据来源：按批流式读取，避免 UI 分页接口的重复元数据查询
export interface DatabaseDumpTableSource {
  total: number
  readNext: () => Promise<Record<string, unknown>[]>
}

interface DatabaseDumpSource {
  openTable: (table: DatabaseModelTable) => Promise<DatabaseDumpTableSource>
}

export interface DatabaseDumpWriteOptions {
  includeDropStatements?: boolean
  disableForeignKeyChecks?: boolean
  stripDefiners?: boolean
  objectDdls?: DatabaseBackupObjectDdl[]
  onProgress?: (
    phase: DatabaseBackupProgress['phase'],
    percent: number,
    message: string,
  ) => void
}

function temporaryPath(outputPath: string): string {
  return path.join(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.${process.pid}.${Date.now()}.tmp`,
  )
}

function safeFileName(value: string): string {
  const normalized = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim()
  return normalized || 'database'
}

function terminatedDdl(ddl: string): string {
  const normalized = ddl.trim()
  if (!normalized) return ''
  return `${normalized.replace(/;+\s*$/, '')};\n\n`
}

function dumpHeader(model: DatabaseModel, mode: DatabaseDumpMode): string {
  const modeLabel = {
    'structure-data': '结构和数据',
    structure: '仅结构',
    data: '仅数据',
  }[mode]
  return [
    '-- SQLTool 数据库转储',
    `-- 数据库: ${model.name}`,
    `-- 类型: ${model.type}`,
    `-- 模式: ${modeLabel}`,
    `-- 生成时间: ${new Date().toISOString()}`,
    '',
  ].join('\n')
}

export async function writeDatabaseDumpFile(
  model: DatabaseModel,
  mode: DatabaseDumpMode,
  source: DatabaseDumpSource,
): Promise<DatabaseDumpResult> {
  const selection = await dialog.showSaveDialog({
    title: '转储 SQL 文件',
    defaultPath: `${safeFileName(model.name)}.sql`,
    filters: [{ name: 'SQL 文件', extensions: ['sql'] }],
  })
  if (selection.canceled || !selection.filePath) {
    return {
      cancelled: true,
      tableCount: model.tables.length,
      rowCount: 0,
    }
  }
  return writeDatabaseDumpToPath(
    model,
    mode,
    source,
    selection.filePath,
  )
}

export async function writeDatabaseDumpToPath(
  model: DatabaseModel,
  mode: DatabaseDumpMode,
  source: DatabaseDumpSource,
  outputPath: string,
  options: DatabaseDumpWriteOptions = {},
): Promise<DatabaseDumpResult> {
  const pendingPath = temporaryPath(outputPath)
  let handle: fs.promises.FileHandle | undefined
  let rowCount = 0
  const objectDdls = options.objectDdls || []
  const tableSql = mode === 'data'
    ? []
    : model.tables.map(table => buildDatabaseBackupTableSql(model, table))
  const deferredConstraintSql = tableSql.flatMap(
    table => table.deferredConstraintSql,
  )
  const includeDrop = options.includeDropStatements !== false
  const report = (
    phase: DatabaseBackupProgress['phase'],
    percent: number,
    message: string,
  ) => options.onProgress?.(phase, percent, message)
  try {
    report('prepare', 5, '正在创建备份文件')
    handle = await fs.promises.open(pendingPath, 'w')
    await handle.write(dumpHeader(model, mode))
    const guard = options.disableForeignKeyChecks
      ? foreignKeyGuardSql(
        model.type,
        model.tables.map(table => table.name),
      )
      : { before: '', after: '' }
    const deferredObjects = mode === 'structure'
      ? []
      : objectDdls.filter(
        object => object.kind === 'event' || object.kind === 'trigger',
      )
    const structureObjects = mode === 'structure'
      ? objectDdls
      : objectDdls.filter(object => !deferredObjects.includes(object))
    const writeObjects = async (objects: DatabaseBackupObjectDdl[]) => {
      for (const object of objects) {
        const ddl = formatObjectDdl(
          model.type,
          object,
          Boolean(options.stripDefiners),
        )
        if (!ddl) continue
        await handle!.write(`-- ${object.kind}: ${object.name}\n${ddl}`)
      }
    }
    if (guard.before) await handle.write(guard.before)

    if (mode !== 'data') {
      if (includeDrop) {
        const objectReset = [...objectDdls]
          .reverse()
          .map(object => buildDropObjectSql(model.type, object))
          .filter(Boolean)
          .join('\n')
        if (objectReset) {
          await handle.write(`-- 回导准备: 删除同名附属对象\n${objectReset}\n\n`)
        }
        await handle.write(buildStructureResetSql(model))
      }
      logger.info(
        'DatabaseDump',
        `结构覆盖语句写入完成: 数据库=${model.name}, 类型=${model.type}, 删除表=${includeDrop ? model.tables.length : 0}, 附属对象=${objectDdls.length}`,
      )
      for (const [index, table] of model.tables.entries()) {
        await handle.write(`-- 表结构: ${table.name}\n`)
        const ddl = terminatedDdl(tableSql[index]?.createSql || table.ddl)
        await handle.write(ddl || `-- 未能读取表 ${table.name} 的 DDL\n\n`)
        report(
          'structure',
          10 + Math.round(((index + 1) / Math.max(1, model.tables.length)) * 20),
          `已写入表结构 ${index + 1}/${model.tables.length}: ${table.name}`,
        )
      }
      if (mode === 'structure' && deferredConstraintSql.length > 0) {
        await handle.write(
          `-- 延后创建外键约束\n${deferredConstraintSql.join('\n')}\n\n`,
        )
      }
      await writeObjects(structureObjects)
    }

    if (mode !== 'structure') {
      for (const [tableIndex, table] of model.tables.entries()) {
        const columns = table.fields.map(field => field.name)
        const dataSql = backupTableDataSql(model, table)
        await handle.write(`-- 表数据: ${table.name}\n`)
        if (columns.length === 0) {
          await handle.write('-- 未读取到字段，已跳过数据转储\n\n')
          continue
        }

        if (dataSql.before) await handle.write(dataSql.before)
        const tableStartedAt = Date.now()
        const tableSource = await source.openTable(table)
        const overrideSystemValue = (
          model.type === 'PostgreSQL'
          && table.fields.some(field => field.auto_increment)
        )
        // 数据阶段进度在表区间内按行数线性插值，避免大表长时间无进度反馈
        const tablePercentBase = 30 + Math.round(
          (tableIndex / Math.max(1, model.tables.length)) * 60,
        )
        const tablePercentSpan = Math.round(
          60 / Math.max(1, model.tables.length),
        )
        let tableRows = 0
        let batches = 0
        let lastReportedRows = 0
        // 读写流水线：写入当前批次的同时预取下一批，隐藏数据库往返延迟
        let rows = await tableSource.readNext()
        while (rows.length > 0) {
          const pendingNext = tableSource.readNext()
          // 写盘若抛错会跳出循环，这里提前挂观察器避免预取 Promise 未处理 rejection
          pendingNext.catch(() => undefined)
          await handle.write(backupInsertRowsSql(
            model.type,
            table.name,
            columns,
            rows,
            { overrideSystemValue },
          ))
          tableRows += rows.length
          batches += 1
          // 每表最多按 5 万行粒度上报一次中间进度，避免刷爆 IPC
          if (tableRows - lastReportedRows >= 50000) {
            lastReportedRows = tableRows
            const innerRatio = tableSource.total > 0
              ? Math.min(1, tableRows / tableSource.total)
              : 0
            report(
              'data',
              tablePercentBase + Math.round(innerRatio * tablePercentSpan),
              `正在写入表数据 ${tableIndex + 1}/${model.tables.length}: ${table.name}(${tableRows}/${tableSource.total} 行)`,
            )
          }
          rows = await pendingNext
        }
        rowCount += tableRows
        logger.debug(
          'DatabaseDump',
          `表数据写入完成: 表=${table.name}, 行=${tableRows}, 批次=${batches}, 耗时=${Date.now() - tableStartedAt}ms`,
        )
        if (dataSql.after) await handle.write(dataSql.after)
        await handle.write('\n')
        report(
          'data',
          30 + Math.round(
            ((tableIndex + 1) / Math.max(1, model.tables.length)) * 60,
          ),
          `已写入表数据 ${tableIndex + 1}/${model.tables.length}: ${table.name}(${tableRows} 行)`,
        )
      }
    }

    if (mode === 'structure-data' && deferredConstraintSql.length > 0) {
      await handle.write(
        `-- 数据写入完成后创建外键约束\n${deferredConstraintSql.join('\n')}\n\n`,
      )
    }
    // 触发器和事件必须在数据写入后创建，避免回导 INSERT 时触发业务副作用。
    await writeObjects(deferredObjects)
    if (guard.after) await handle.write(guard.after)
    await handle.close()
    handle = undefined
    await replaceExportFile(pendingPath, outputPath)
    report('complete', 100, 'SQL 备份文件写入完成')
    logger.info(
      'DatabaseDump',
      `数据库转储文件写入完成: 数据库=${model.name}, 表=${model.tables.length}, 外键=${deferredConstraintSql.length}, 行=${rowCount}, 文件=${path.basename(outputPath)}`,
    )
    return {
      cancelled: false,
      filePath: outputPath,
      tableCount: model.tables.length,
      rowCount,
    }
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined)
    await fs.promises.rm(pendingPath, { force: true }).catch(() => undefined)
    logger.error(
      'DatabaseDump',
      `数据库转储文件写入失败: 数据库=${model.name}, 原因=${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
    )
    throw error
  }
}
