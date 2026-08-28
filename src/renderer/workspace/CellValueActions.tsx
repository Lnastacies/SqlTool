import React from 'react'
import { Button } from 'antd'

interface CellValueActionsProps {
  allowNull: boolean
  allowDefault: boolean
  onSetNull: () => void
  onSetDefault: () => void
}

export default function CellValueActions({
  allowNull,
  allowDefault,
  onSetNull,
  onSetDefault,
}: CellValueActionsProps) {
  return (
    <div className="data-cell-value-actions">
      <Button
        size="small"
        disabled={!allowNull}
        title={allowNull ? '设为 NULL（Ctrl+0）' : '字段不允许 NULL'}
        onClick={onSetNull}
      >
        NULL
      </Button>
      {allowDefault && (
        <Button
          size="small"
          title="使用数据库默认值（从 INSERT 字段列表中省略）"
          onClick={onSetDefault}
        >
          DEF
        </Button>
      )}
    </div>
  )
}
