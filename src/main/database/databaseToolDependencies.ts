import type { TableMetadata } from './adapters'

export interface DependencyOrder {
  tables: string[]
  hasCycle: boolean
}

export function orderTablesByForeignKeys(
  tables: string[],
  metadata: Map<string, TableMetadata>,
): DependencyOrder {
  const selected = new Set(tables)
  const pending = new Set(tables)
  const ordered: string[] = []
  let hasCycle = false

  while (pending.size > 0) {
    const ready = Array.from(pending).filter(table => (
      (metadata.get(table)?.foreign_keys || []).every(foreignKey => (
        !selected.has(foreignKey.referenced_table)
        || ordered.includes(foreignKey.referenced_table)
      ))
    ))
    if (ready.length === 0) {
      // 循环外键无法仅通过顺序解决，保留用户选择顺序并在预检查中提示。
      ordered.push(...tables.filter(table => pending.has(table)))
      hasCycle = true
      break
    }
    ready.forEach(table => {
      ordered.push(table)
      pending.delete(table)
    })
  }
  return { tables: ordered, hasCycle }
}
