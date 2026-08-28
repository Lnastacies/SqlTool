import type { AppCommandId, MenuGroup } from './commandTypes'

export const MENU_GROUPS: MenuGroup[] = [
  {
    key: 'file',
    label: '文件',
    items: [
      'connection.new',
      'query.new',
      'divider',
      'file.openSql',
      'file.save',
      'file.saveAs',
      'divider',
      'application.exit',
    ],
  },
  {
    key: 'edit',
    label: '编辑',
    items: [
      'edit.undo',
      'edit.redo',
      'divider',
      'edit.find',
      'edit.replace',
    ],
  },
  {
    key: 'view',
    label: '查看',
    items: [
      'view.objects',
      'view.details',
      'view.refresh',
      'divider',
      'view.theme',
    ],
  },
  {
    key: 'favorites',
    label: '收藏夹',
    items: ['favorite.add', 'favorite.manage'],
  },
  {
    key: 'tools',
    label: '工具',
    items: [
      'tool.transfer',
      'tool.dataSync',
      'tool.structureSync',
      'divider',
      'tool.backup',
      'tool.automation',
      'tool.model',
      'tool.report',
    ],
  },
  {
    key: 'window',
    label: '窗口',
    items: ['window.close', 'window.closeAll'],
  },
  {
    key: 'help',
    label: '关于',
    items: ['help.about', 'help.changelog'],
  },
]

export const TOOLBAR_GROUPS: AppCommandId[][] = [
  ['connection.new', 'query.new'],
  [
    'object.table',
    'object.view',
    'object.function',
    'object.event',
    'object.query',
    'tool.report',
    'tool.backup',
  ],
  [
    'tool.automation',
    'tool.model',
    'object.user',
  ],
  [
    'tool.transfer',
    'tool.dataSync',
    'tool.structureSync',
  ],
  ['view.details', 'view.theme'],
]
