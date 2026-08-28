import React, { useRef, useState } from 'react'
import { Button, Input, message, Modal } from 'antd'
import EyeOutlined from '@ant-design/icons/EyeOutlined'
import FolderOpenOutlined from '@ant-design/icons/FolderOpenOutlined'

interface BinaryCellEditorProps {
  value: unknown
  onChange: (value: Uint8Array) => void
}

const MAX_PREVIEW_BYTES = 4096

export default function BinaryCellEditor({
  value,
  onChange,
}: BinaryCellEditorProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const bytes = value instanceof Uint8Array ? value : null

  const loadFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const nextValue = new Uint8Array(await file.arrayBuffer())
      onChange(nextValue)
      void window.logger?.write(
        'info',
        'DataEditor',
        `二进制字段已载入本地文件: 文件=${file.name}, 字节数=${nextValue.length}`,
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`读取二进制文件失败：${detail}`)
      void window.logger?.write(
        'error',
        'DataEditor',
        `读取二进制文件失败: ${detail}`,
      )
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <>
      <div className="data-cell-editor data-cell-editor--binary">
        <Input
          size="small"
          readOnly
          value={binarySummary(value)}
          title={binarySummary(value)}
        />
        <Button
          size="small"
          icon={<EyeOutlined />}
          disabled={!bytes}
          title="查看十六进制内容"
          onClick={() => setPreviewOpen(true)}
        />
        <Button
          size="small"
          icon={<FolderOpenOutlined />}
          title="从本地文件载入"
          onClick={() => fileInput.current?.click()}
        />
        <input
          ref={fileInput}
          hidden
          type="file"
          onChange={event => void loadFile(event.target.files?.[0])}
        />
      </div>
      <Modal
        title={`二进制查看器 · ${bytes?.length || 0} bytes`}
        open={previewOpen}
        footer={null}
        width={760}
        destroyOnHidden
        onCancel={() => setPreviewOpen(false)}
      >
        <Input.TextArea
          readOnly
          value={bytes ? toHexPreview(bytes) : ''}
          autoSize={{ minRows: 12, maxRows: 24 }}
          className="binary-cell-editor__preview"
        />
        {bytes && bytes.length > MAX_PREVIEW_BYTES && (
          <div className="binary-cell-editor__hint">
            仅预览前 {MAX_PREVIEW_BYTES} 字节，完整数据不会被截断。
          </div>
        )}
      </Modal>
    </>
  )
}

function binarySummary(value: unknown): string {
  if (value === undefined) return 'DEFAULT'
  if (value === null) return 'NULL'
  if (value instanceof Uint8Array) return `[BINARY ${value.length} bytes]`
  return `[BINARY ${String(value).length} chars]`
}

function toHexPreview(bytes: Uint8Array): string {
  const preview = bytes.slice(0, MAX_PREVIEW_BYTES)
  const lines: string[] = []
  for (let offset = 0; offset < preview.length; offset += 16) {
    const chunk = preview.slice(offset, offset + 16)
    const hex = Array.from(chunk)
      .map(value => value.toString(16).padStart(2, '0'))
      .join(' ')
      .padEnd(47, ' ')
    const text = Array.from(chunk)
      .map(value => value >= 32 && value <= 126 ? String.fromCharCode(value) : '.')
      .join('')
    lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex}  ${text}`)
  }
  return lines.join('\n')
}
