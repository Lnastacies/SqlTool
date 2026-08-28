import React from 'react'
import type { MenuProps } from 'antd'
import {
  DATABASE_OBJECT_ACTIONS,
  type DatabaseObjectAction,
  type DatabaseObjectActionId,
} from '../database-objects/databaseObjectPresentation'

interface TableObjectContextMenuOptions {
  onAction: (action: DatabaseObjectAction) => void
}

type MenuItem = NonNullable<MenuProps['items']>[number]

const divider = (): MenuItem => ({ type: 'divider' })

const MENU_GROUPS: DatabaseObjectActionId[][] = [
  ['open', 'design'],
  ['create'],
  ['delete', 'truncate'],
  ['import', 'export'],
]

export function buildTableObjectContextMenu({
  onAction,
}: TableObjectContextMenuOptions): MenuProps['items'] {
  const actions = new Map(
    DATABASE_OBJECT_ACTIONS.tables.map(action => [action.id, action]),
  )

  return MENU_GROUPS.flatMap((group, groupIndex) => {
    const items = group.flatMap<MenuItem>(actionId => {
      const action = actions.get(actionId)
      if (!action) return []
      return [{
        key: action.id,
        label: action.label,
        icon: action.icon,
        danger: action.id === 'delete' || action.id === 'truncate',
        onClick: () => onAction(action),
      }]
    })
    return groupIndex === 0 ? items : [divider(), ...items]
  })
}
