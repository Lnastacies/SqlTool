import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Modal,
  Steps,
  message,
} from 'antd'
import type {
  TableFieldMetadata,
  TableImportOptions,
  TableImportPreview,
  TableImportRequest,
} from '../../types'
import {
  buildTableImportRequest,
  createImportMappings,
  validateImportMappings,
  type TableImportMappingDraft,
} from './tableTransferModel'
import { createTableImportOptions } from './tableTransferDefaults'
import TableImportReviewStep from './TableImportReviewStep'
import TableImportSourceStep from './TableImportSourceStep'
import TableImportTabs from './TableImportTabs'

interface TableImportDialogProps {
  open: boolean
  tableName: string
  fields: TableFieldMetadata[]
  preview: TableImportPreview
  importing: boolean
  onCancel: () => void
  onReload: (
    filePath: string,
    options: TableImportOptions,
  ) => Promise<TableImportPreview>
  onImport: (request: TableImportRequest) => Promise<void>
}

export default function TableImportDialog({
  open,
  tableName,
  fields,
  preview,
  importing,
  onCancel,
  onReload,
  onImport,
}: TableImportDialogProps) {
  const [step, setStep] = useState(0)
  const [workingPreview, setWorkingPreview] = useState(preview)
  const [options, setOptions] = useState<TableImportOptions>(
    createTableImportOptions(preview),
  )
  const [mappings, setMappings] = useState<TableImportMappingDraft[]>([])
  const [emptyStringAsNull, setEmptyStringAsNull] = useState(false)
  const [reparsing, setReparsing] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(0)
    setWorkingPreview(preview)
    setOptions(createTableImportOptions(preview))
    setMappings(createImportMappings(preview.columns, fields))
    setEmptyStringAsNull(false)
  }, [fields, open, preview])

  const validationError = useMemo(
    () => validateImportMappings(mappings, fields),
    [fields, mappings],
  )

  const parseAndContinue = async () => {
    if (!workingPreview.filePath) {
      message.error('导入文件路径无效，请重新打开导入向导')
      return
    }
    setReparsing(true)
    try {
      const refreshed = await onReload(workingPreview.filePath, options)
      setWorkingPreview(refreshed)
      setMappings(createImportMappings(refreshed.columns, fields))
      setStep(1)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`按当前格式设置解析失败：${detail}`)
    } finally {
      setReparsing(false)
    }
  }

  const submit = async () => {
    if (validationError) {
      message.warning(validationError)
      return
    }
    await onImport(buildTableImportRequest(
      workingPreview,
      mappings,
      emptyStringAsNull,
    ))
  }

  const footer = step === 0
    ? [
      <Button key="cancel" onClick={onCancel}>取消</Button>,
      <Button
        key="parse"
        type="primary"
        loading={reparsing}
        onClick={() => void parseAndContinue()}
      >
        解析并继续
      </Button>,
    ]
    : step === 1
      ? [
        <Button key="back" onClick={() => setStep(0)}>上一步</Button>,
        <Button
          key="next"
          type="primary"
          disabled={Boolean(validationError)}
          onClick={() => setStep(2)}
        >
          下一步
        </Button>,
      ]
      : [
        <Button key="back" disabled={importing} onClick={() => setStep(1)}>
          上一步
        </Button>,
        <Button
          key="import"
          type="primary"
          loading={importing}
          onClick={() => void submit()}
        >
          导入 {workingPreview.totalRows} 行
        </Button>,
      ]

  return (
    <Modal
      open={open}
      width={980}
      title={`导入向导：${tableName}`}
      footer={footer}
      onCancel={onCancel}
      maskClosable={false}
      keyboard={!importing && !reparsing}
      destroyOnClose
      className="table-transfer-modal"
    >
      <Steps
        size="small"
        current={step}
        items={[
          { title: '文件与格式' },
          { title: '字段与数据' },
          { title: '确认导入' },
        ]}
      />

      {step === 0 && (
        <TableImportSourceStep
          preview={workingPreview}
          options={options}
          onChange={setOptions}
        />
      )}

      {step === 1 && (
        <>
          <Alert
            type={validationError ? 'warning' : 'success'}
            showIcon
            message={validationError || '字段映射有效，导入将在一个事务中完成'}
          />
          <TableImportTabs
            fields={fields}
            preview={workingPreview}
            mappings={mappings}
            onMappingsChange={setMappings}
          />
          <Checkbox
            checked={emptyStringAsNull}
            onChange={event => setEmptyStringAsNull(event.target.checked)}
          >
            将空字符串转换为 NULL
          </Checkbox>
        </>
      )}

      {step === 2 && (
        <TableImportReviewStep
          tableName={tableName}
          preview={workingPreview}
          options={options}
          mappings={mappings}
          emptyStringAsNull={emptyStringAsNull}
        />
      )}
    </Modal>
  )
}
