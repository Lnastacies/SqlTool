import React from 'react'
import { Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { MENU_GROUPS } from '../commands/commandLayout'
import type {
  AppCommandId,
  CommandController,
} from '../commands/commandTypes'
import type { RecentSqlFile } from '../types'

interface AppMenuProps {
  commands: CommandController
  recentFiles: RecentSqlFile[]
  onOpenRecentFile: (filePath: string) => void
  onClearRecentFiles: () => void
}

function AppMenu({
  commands,
  recentFiles,
  onOpenRecentFile,
  onClearRecentFiles,
}: AppMenuProps) {
  const buildRecentFileItem = (): NonNullable<MenuProps['items']>[number] => ({
    key: 'recent-files',
    label: '最近文件',
    children: recentFiles.length > 0
      ? [
          ...recentFiles.map((file, index) => ({
            key: `recent-file-${index}`,
            label: (
              <span className="app-menu__recent" title={file.filePath}>
                <span>{file.name}</span>
                <small>{file.filePath}</small>
              </span>
            ),
          })),
          { type: 'divider' as const },
          { key: 'recent-files-clear', label: '清空最近文件' },
        ]
      : [{ key: 'recent-files-empty', label: '暂无最近文件', disabled: true }],
  })

  const buildItems = (
    items: Array<AppCommandId | 'divider'>,
    includeRecentFiles: boolean,
  ): MenuProps['items'] => {
    const menuItems: NonNullable<MenuProps['items']> = items.map(
      (item, index) => {
        if (item === 'divider') {
          return { type: 'divider', key: `divider-${index}` }
        }

        const command = commands.get(item)
        return {
          key: command.id,
          disabled: !command.enabled,
          icon: command.checked
            ? <span className="app-menu__check">✓</span>
            : null,
          label: (
            <span
              className="app-menu__command"
              title={command.disabledReason}
            >
              <span>{command.label}</span>
              {command.shortcut && <kbd>{command.shortcut}</kbd>}
            </span>
          ),
        }
      },
    )
    if (includeRecentFiles) {
      const openIndex = menuItems.findIndex(item => item?.key === 'file.openSql')
      menuItems.splice(openIndex + 1, 0, buildRecentFileItem())
    }
    return menuItems
  }

  return (
    <nav className="app-menu" aria-label="应用菜单">
      <div className="app-menu__items">
        {MENU_GROUPS.map(menu => (
          <Dropdown
            key={menu.key}
            menu={{
              items: buildItems(menu.items, menu.key === 'file'),
              onClick: ({ key }) => {
                if (key === 'recent-files-clear') {
                  onClearRecentFiles()
                  return
                }
                if (key.startsWith('recent-file-')) {
                  const index = Number(key.replace('recent-file-', ''))
                  const file = recentFiles[index]
                  if (file) onOpenRecentFile(file.filePath)
                  return
                }
                void commands.execute(key as AppCommandId)
              },
            }}
            trigger={['click']}
          >
            <button className="app-menu__item" type="button">
              {menu.label}
            </button>
          </Dropdown>
        ))}
      </div>
    </nav>
  )
}

export default AppMenu
