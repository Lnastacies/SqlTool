import type {
  DatabaseObjectCategory,
} from '../features/database-objects/databaseObjectModel'

export type AppCommandId =
  | 'connection.new'
  | 'query.new'
  | 'query.execute'
  | 'query.executeAll'
  | 'query.stop'
  | 'file.openSql'
  | 'file.save'
  | 'file.saveAs'
  | 'application.exit'
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.find'
  | 'edit.replace'
  | 'view.objects'
  | 'view.details'
  | 'view.refresh'
  | 'view.theme'
  | 'favorite.add'
  | 'favorite.manage'
  | 'object.table'
  | 'object.view'
  | 'object.function'
  | 'object.event'
  | 'object.query'
  | 'object.user'
  | 'tool.transfer'
  | 'tool.dataSync'
  | 'tool.structureSync'
  | 'tool.report'
  | 'tool.backup'
  | 'tool.automation'
  | 'tool.model'
  | 'window.close'
  | 'window.closeAll'
  | 'help.about'
  | 'help.changelog'

export interface CommandDefinition {
  id: AppCommandId
  label: string
  shortcut?: string
  enabled: boolean
  checked?: boolean
  disabledReason?: string
  execute: () => void | Promise<void>
}

export interface CommandController {
  get: (id: AppCommandId) => CommandDefinition
  execute: (id: AppCommandId) => Promise<void>
}

export interface CommandActions {
  newConnection: () => void
  newQuery: () => void
  openSqlFiles: () => void | Promise<void>
  saveSqlFile: () => void | Promise<void>
  saveSqlFileAs: () => void | Promise<void>
  executeQuery: () => void
  executeAllQuery: () => void
  stopQuery: () => void
  showObjects: () => void
  selectObjectCategory: (category: DatabaseObjectCategory) => void
  toggleDetails: () => void
  toggleTheme: () => void
  refresh: () => void
  openDataTransfer: () => void
  openDataSync: () => void
  openStructureSync: () => void
  openModel: () => void
  openAutomation: () => void
  favoriteAdd: () => void
  favoriteManage: () => void
  openUserManagement: () => void
  closeCurrent: () => void
  closeAll: () => void
  exit: () => void
  showAbout: () => void
  showChangelog: () => void
  notifyUnavailable: (label: string) => void
}

export interface CommandState {
  canCreateQuery: boolean
  canExecuteQuery: boolean
  canStopQuery: boolean
  canSaveSqlFile: boolean
  canShowObjects: boolean
  canUseDatabaseTools: boolean
  canFavoriteCurrent: boolean
  activeObjectCategory: DatabaseObjectCategory
  detailsVisible: boolean
  hasActiveDocument: boolean
  hasDocuments: boolean
  theme: 'light' | 'dark'
}

export interface MenuGroup {
  key: string
  label: string
  items: Array<AppCommandId | 'divider'>
}
