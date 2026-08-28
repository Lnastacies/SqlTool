import type {
  AppCommandId,
  CommandActions,
  CommandDefinition,
  CommandState,
} from './commandTypes'

const labels: Record<AppCommandId, string> = {
  'connection.new': '连接',
  'query.new': '新建查询',
  'query.execute': '运行',
  'query.executeAll': '全部运行',
  'query.stop': '停止运行',
  'file.openSql': '打开 SQL 文件',
  'file.save': '保存',
  'file.saveAs': '另存为',
  'application.exit': '退出',
  'edit.undo': '撤销',
  'edit.redo': '重做',
  'edit.find': '查找',
  'edit.replace': '替换',
  'view.objects': '对象窗口',
  'view.details': '详细信息',
  'view.refresh': '刷新',
  'view.theme': '切换主题',
  'favorite.add': '添加到收藏夹',
  'favorite.manage': '管理收藏夹',
  'object.table': '表',
  'object.view': '视图',
  'object.function': '函数',
  'object.event': '事件',
  'object.query': '查询',
  'object.user': '用户',
  'tool.transfer': '数据传输',
  'tool.dataSync': '数据同步',
  'tool.structureSync': '结构同步',
  'tool.report': '报表',
  'tool.backup': '备份',
  'tool.automation': '自动运行',
  'tool.model': '模型',
  'window.close': '关闭当前窗口',
  'window.closeAll': '关闭所有窗口',
  'help.about': '关于 SQLTool',
  'help.changelog': '版本更新',
}

const shortcuts: Partial<Record<AppCommandId, string>> = {
  'connection.new': 'Ctrl+N',
  'query.new': 'Ctrl+T',
  'query.execute': 'Ctrl+Enter',
  'query.executeAll': 'Ctrl+Shift+Enter',
  'query.stop': 'Ctrl+.',
  'file.openSql': 'Ctrl+O',
  'file.save': 'Ctrl+S',
  'file.saveAs': 'Ctrl+Shift+S',
  'edit.undo': 'Ctrl+Z',
  'edit.redo': 'Ctrl+Y',
  'edit.find': 'Ctrl+F',
  'edit.replace': 'Ctrl+H',
  'view.refresh': 'F5',
  'window.close': 'Ctrl+W',
}

export function createCommandDefinitions(
  actions: CommandActions,
  state: CommandState,
): CommandDefinition[] {
  const unavailable = (id: AppCommandId): CommandDefinition => ({
    id,
    label: labels[id],
    shortcut: shortcuts[id],
    enabled: true,
    execute: () => actions.notifyUnavailable(labels[id]),
  })

  const definitions = (Object.keys(labels) as AppCommandId[]).map(unavailable)
  const overrides: Partial<Record<AppCommandId, Partial<CommandDefinition>>> = {
    'connection.new': { execute: actions.newConnection },
    'query.new': {
      enabled: state.canCreateQuery,
      disabledReason: state.canCreateQuery ? undefined : '请先选择并连接数据库',
      execute: actions.newQuery,
    },
    'query.execute': {
      enabled: state.canExecuteQuery,
      disabledReason: state.canExecuteQuery ? undefined : '当前没有可执行的查询',
      execute: actions.executeQuery,
    },
    'query.executeAll': {
      enabled: state.canExecuteQuery,
      disabledReason: state.canExecuteQuery ? undefined : '当前没有可执行的查询',
      execute: actions.executeAllQuery,
    },
    'query.stop': {
      enabled: state.canStopQuery,
      disabledReason: state.canStopQuery ? undefined : '当前没有可停止的查询',
      execute: actions.stopQuery,
    },
    'file.openSql': { execute: actions.openSqlFiles },
    'file.save': {
      enabled: state.canSaveSqlFile,
      disabledReason: state.canSaveSqlFile ? undefined : '当前窗口不是查询文档',
      execute: actions.saveSqlFile,
    },
    'file.saveAs': {
      enabled: state.canSaveSqlFile,
      disabledReason: state.canSaveSqlFile ? undefined : '当前窗口不是查询文档',
      execute: actions.saveSqlFileAs,
    },
    'application.exit': { execute: actions.exit },
    'view.objects': {
      enabled: state.canShowObjects,
      disabledReason: state.canShowObjects ? undefined : '请先选择数据库',
      execute: actions.showObjects,
    },
    'object.table': {
      enabled: state.canShowObjects,
      checked: state.activeObjectCategory === 'tables',
      disabledReason: state.canShowObjects ? undefined : '请先选择数据库',
      execute: () => actions.selectObjectCategory('tables'),
    },
    'object.view': {
      enabled: state.canShowObjects,
      checked: state.activeObjectCategory === 'views',
      disabledReason: state.canShowObjects ? undefined : '请先选择数据库',
      execute: () => actions.selectObjectCategory('views'),
    },
    'object.function': {
      enabled: state.canShowObjects,
      checked: state.activeObjectCategory === 'functions',
      disabledReason: state.canShowObjects ? undefined : '请先选择数据库',
      execute: () => actions.selectObjectCategory('functions'),
    },
    'object.event': {
      enabled: state.canShowObjects,
      checked: state.activeObjectCategory === 'events',
      disabledReason: state.canShowObjects ? undefined : '请先选择数据库',
      execute: () => actions.selectObjectCategory('events'),
    },
    'object.query': {
      enabled: state.canShowObjects,
      checked: state.activeObjectCategory === 'queries',
      disabledReason: state.canShowObjects ? undefined : '请先选择数据库',
      execute: () => actions.selectObjectCategory('queries'),
    },
    'tool.report': {
      enabled: state.canShowObjects,
      checked: state.activeObjectCategory === 'reports',
      disabledReason: state.canShowObjects ? undefined : '请先选择数据库',
      execute: () => actions.selectObjectCategory('reports'),
    },
    'tool.backup': {
      enabled: state.canShowObjects,
      checked: state.activeObjectCategory === 'backups',
      disabledReason: state.canShowObjects ? undefined : '请先选择数据库',
      execute: () => actions.selectObjectCategory('backups'),
    },
    'tool.transfer': {
      enabled: state.canUseDatabaseTools,
      disabledReason: state.canUseDatabaseTools
        ? undefined
        : '请先创建至少一个数据库连接',
      execute: actions.openDataTransfer,
    },
    'tool.dataSync': {
      enabled: state.canUseDatabaseTools,
      disabledReason: state.canUseDatabaseTools
        ? undefined
        : '请先创建至少一个数据库连接',
      execute: actions.openDataSync,
    },
    'tool.structureSync': {
      enabled: state.canUseDatabaseTools,
      disabledReason: state.canUseDatabaseTools
        ? undefined
        : '请先创建至少一个数据库连接',
      execute: actions.openStructureSync,
    },
    'tool.model': {
      enabled: state.canShowObjects,
      disabledReason: state.canShowObjects
        ? undefined
        : '请先选择数据库',
      execute: actions.openModel,
    },
    'tool.automation': {
      enabled: state.canUseDatabaseTools,
      disabledReason: state.canUseDatabaseTools
        ? undefined
        : '请先创建至少一个数据库连接',
      execute: actions.openAutomation,
    },
    'favorite.add': {
      enabled: state.canFavoriteCurrent,
      disabledReason: state.canFavoriteCurrent
        ? undefined
        : '请先选择数据库对象或打开查询文档',
      execute: actions.favoriteAdd,
    },
    'favorite.manage': {
      execute: actions.favoriteManage,
    },
    'object.user': {
      enabled: state.canUseDatabaseTools,
      disabledReason: state.canUseDatabaseTools
        ? undefined
        : '请先创建至少一个数据库连接',
      execute: actions.openUserManagement,
    },
    'view.details': {
      checked: state.detailsVisible,
      execute: actions.toggleDetails,
    },
    'view.refresh': { execute: actions.refresh },
    'view.theme': {
      label: state.theme === 'light' ? '深色主题' : '浅色主题',
      checked: state.theme === 'dark',
      execute: actions.toggleTheme,
    },
    'window.close': {
      enabled: state.hasActiveDocument,
      disabledReason: state.hasActiveDocument ? undefined : '当前没有可关闭的窗口',
      execute: actions.closeCurrent,
    },
    'window.closeAll': {
      enabled: state.hasDocuments,
      disabledReason: state.hasDocuments ? undefined : '当前没有可关闭的窗口',
      execute: actions.closeAll,
    },
    'help.about': { execute: actions.showAbout },
    'help.changelog': { execute: actions.showChangelog },
  }

  return definitions.map(definition => ({
    ...definition,
    ...overrides[definition.id],
  }))
}
