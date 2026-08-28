import { quoteTableIdentifier } from './tableStructureSqlCommon'
import type { DatabaseModel } from './databaseManagementTypes'

export function buildStructureResetSql(model: DatabaseModel): string {
  const statements = [...model.tables]
    // 模型按外键依赖正序排列，删除时反向处理可优先移除子表。
    .reverse()
    .map(table => (
      `DROP TABLE IF EXISTS ${quoteTableIdentifier(table.name, model.type)};`
    ))

  if (statements.length === 0) return ''
  return [
    '-- 回导准备: 删除同名旧表',
    '-- 警告: 执行以下语句会覆盖目标数据库中的同名表及数据',
    ...statements,
    '',
    '',
  ].join('\n')
}
