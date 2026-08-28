import React from 'react'
import ArrowDownOutlined from '@ant-design/icons/ArrowDownOutlined'
import ArrowUpOutlined from '@ant-design/icons/ArrowUpOutlined'
import CopyOutlined from '@ant-design/icons/CopyOutlined'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'
import {
  Button,
  Tooltip,
} from 'antd'

interface TableFieldActionsProps {
  index: number
  fieldCount: number
  onMove: (offset: number) => void
  onDuplicate: () => void
  onDelete: () => void
}

export default function TableFieldActions({
  index,
  fieldCount,
  onMove,
  onDuplicate,
  onDelete,
}: TableFieldActionsProps) {
  return (
    <div className="table-designer__row-actions">
      <Tooltip title="上移">
        <Button
          size="small"
          type="text"
          icon={<ArrowUpOutlined />}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        />
      </Tooltip>
      <Tooltip title="下移">
        <Button
          size="small"
          type="text"
          icon={<ArrowDownOutlined />}
          disabled={index === fieldCount - 1}
          onClick={() => onMove(1)}
        />
      </Tooltip>
      <Tooltip title="复制字段">
        <Button
          size="small"
          type="text"
          icon={<CopyOutlined />}
          onClick={onDuplicate}
        />
      </Tooltip>
      <Tooltip title="删除字段">
        <Button
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          disabled={fieldCount === 1}
          onClick={onDelete}
        />
      </Tooltip>
    </div>
  )
}
