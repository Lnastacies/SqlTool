interface BackupFileNameOptions {
  name: string
  id: string
  createdAt: Date
  compressed: boolean
}

export function normalizeBackupName(value: string): string {
  const normalized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .trim()
    .slice(0, 80)
  if (!normalized) throw new Error('备份名称不能为空')
  return normalized
}

export function backupTimestampToken(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  // 文件名面向本地用户展示，因此使用本地时间，避免 UTC 导致日期偏移。
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
}

export function buildBackupFileName({
  name,
  id,
  createdAt,
  compressed,
}: BackupFileNameOptions): string {
  const extension = compressed ? '.sql.gz' : '.sql'
  return [
    normalizeBackupName(name),
    backupTimestampToken(createdAt),
    id.slice(0, 8),
  ].join('_') + extension
}
