import ExcelJS from 'exceljs'
import {
  MAX_TABLE_IMPORT_ROWS,
  TABLE_EXPORT_PAGE_SIZE,
  type TableExportOptions,
  type TableImportPreview,
} from './tableTransferTypes'
import {
  isSerializedBuffer,
  serializableValue,
  textValue,
} from './tableTransferValueFormat'

interface ExcelExportSource {
  totalRows: number
  loadPage: (
    page: number,
    pageSize: number,
  ) => Promise<Record<string, unknown>[]>
}

function excelCellValue(
  value: unknown,
  binaryEncoding: TableExportOptions['binaryEncoding'],
): ExcelJS.CellValue {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value
  if (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) return value
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Uint8Array || isSerializedBuffer(value)) {
    return String(serializableValue(value, binaryEncoding))
  }
  return textValue(value, binaryEncoding)
}

function importCellValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value !== 'object') return value
  if ('result' in value) return importCellValue(value.result as ExcelJS.CellValue)
  if ('richText' in value) return value.richText.map(item => item.text).join('')
  if ('text' in value) return value.text
  return JSON.stringify(value)
}

export async function parseExcelImportFile(
  filePath: string,
): Promise<Omit<TableImportPreview, 'cancelled' | 'filePath' | 'fileName'>> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('Excel 文件中没有可用工作表')

  const header = worksheet.getRow(1)
  const columns = Array.from(
    { length: header.cellCount },
    (_, index) => String(importCellValue(header.getCell(index + 1).value)).trim(),
  )
  if (columns.length === 0 || columns.every(column => !column)) {
    throw new Error('Excel 第一行必须包含字段标题')
  }
  if (columns.some(column => !column)) throw new Error('Excel 表头包含空字段名')
  if (new Set(columns.map(column => column.toLowerCase())).size !== columns.length) {
    throw new Error('Excel 表头包含重复字段名')
  }

  const rows: Record<string, unknown>[] = []
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const record = Object.fromEntries(columns.map((column, index) => [
      column,
      importCellValue(row.getCell(index + 1).value),
    ]))
    if (Object.values(record).some(value => value !== '')) rows.push(record)
  })
  if (rows.length === 0) throw new Error('Excel 工作表没有可导入的数据行')
  if (rows.length > MAX_TABLE_IMPORT_ROWS) {
    throw new Error(`单次最多导入 ${MAX_TABLE_IMPORT_ROWS} 行数据`)
  }
  return {
    format: 'xlsx',
    sheetName: worksheet.name,
    columns,
    rows,
    totalRows: rows.length,
    options: { format: 'xlsx' },
  }
}

export async function writeExcelExport(
  outputPath: string,
  tableName: string,
  columns: string[],
  source: ExcelExportSource,
  options: TableExportOptions,
): Promise<number> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: outputPath,
    useStyles: true,
    useSharedStrings: true,
  })
  const sheetName = tableName.replace(/[\\/*?:[\]]/g, '_').slice(0, 31) || '数据'
  // ExcelJS 流式工作表的 views 只有 getter，冻结配置必须在创建时传入。
  const worksheet = workbook.addWorksheet(sheetName, {
    views: options.excel?.freezeHeader
      ? [{ state: 'frozen', ySplit: 1 }]
      : [],
  })
  worksheet.columns = columns.map(column => ({
    header: column,
    key: column,
    width: Math.max(12, Math.min(36, column.length + 4)),
  }))
  worksheet.getRow(1).font = { bold: true }
  if (options.excel?.autoFilter && columns.length > 0) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    }
  }
  worksheet.getRow(1).commit()

  let rowCount = 0
  const pageCount = Math.ceil(source.totalRows / TABLE_EXPORT_PAGE_SIZE)
  for (let page = 1; page <= pageCount; page += 1) {
    const rows = await source.loadPage(page, TABLE_EXPORT_PAGE_SIZE)
    for (const row of rows) {
      worksheet.addRow(Object.fromEntries(columns.map(column => [
        column,
        excelCellValue(row[column], options.binaryEncoding),
      ]))).commit()
    }
    rowCount += rows.length
    if (rows.length < TABLE_EXPORT_PAGE_SIZE) break
  }
  worksheet.commit()
  await workbook.commit()
  return rowCount
}
