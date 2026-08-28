import React, { useState } from 'react'
import { Button, Input, message, Modal } from 'antd'
import CodeOutlined from '@ant-design/icons/CodeOutlined'
import { formatEditorValue } from './cellEditorUtils'

interface JsonCellEditorProps {
  value: unknown
  onChange: (value: unknown) => void
}

export default function JsonCellEditor({
  value,
  onChange,
}: JsonCellEditorProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const openEditor = () => {
    setDraft(formatJsonDraft(value))
    setOpen(true)
  }

  const saveJson = () => {
    try {
      const parsed = JSON.parse(draft)
      onChange(parsed)
      setOpen(false)
      void window.logger?.write(
        'info',
        'DataEditor',
        'JSON 字段校验通过并写入待提交变更',
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`JSON 格式无效：${detail}`)
      void window.logger?.write(
        'warn',
        'DataEditor',
        `JSON 字段校验失败: ${detail}`,
      )
    }
  }

  return (
    <>
      <div className="data-cell-editor data-cell-editor--json">
        <Input
          size="small"
          readOnly
          value={formatEditorValue(value)}
          placeholder={
            value === undefined ? 'DEFAULT' : value === null ? 'NULL' : 'JSON'
          }
          title={formatEditorValue(value)}
        />
        <Button
          size="small"
          icon={<CodeOutlined />}
          title="打开 JSON 编辑器"
          onClick={openEditor}
        />
      </div>
      <Modal
        title="编辑 JSON"
        open={open}
        okText="应用"
        cancelText="取消"
        width={680}
        destroyOnHidden
        onOk={saveJson}
        onCancel={() => setOpen(false)}
      >
        <Input.TextArea
          value={draft}
          onChange={event => setDraft(event.target.value)}
          autoSize={{ minRows: 14, maxRows: 24 }}
          spellCheck={false}
          className="json-cell-editor__textarea"
          placeholder='例如：{"enabled": true}'
        />
      </Modal>
    </>
  )
}

function formatJsonDraft(value: unknown): string {
  if (value === null || value === undefined) return ''
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return JSON.stringify(parsed, null, 2)
  } catch {
    return formatEditorValue(value)
  }
}
