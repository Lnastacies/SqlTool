import React, { useEffect, useMemo, useState } from 'react'
import { Button, Modal, Steps, message } from 'antd'
import type {
  DatabaseType,
  TableExportBatchRequest,
  TableExportObjectMetadata,
  TableExportOptions,
} from '../../types'
import TableExportContentStep from './TableExportContentStep'
import TableExportFormatStep from './TableExportFormatStep'
import TableExportReviewStep from './TableExportReviewStep'
import { createTableExportOptions } from './tableTransferDefaults'

interface TableExportDialogProps {
  open: boolean
  databaseType: DatabaseType
  objects: TableExportObjectMetadata[]
  initialSelection?: string[]
  exporting: boolean
  onCancel: () => void
  onExport: (request: TableExportBatchRequest) => Promise<void>
}

function initialObjectNames(
  objects: TableExportObjectMetadata[],
  preferred: string[] = [],
): string[] {
  const available = new Set(objects.map(object => object.name))
  const selected = preferred.filter(name => available.has(name))
  return selected.length > 0 ? selected : objects.slice(0, 1).map(item => item.name)
}

export default function TableExportDialog({
  open,
  databaseType,
  objects,
  initialSelection,
  exporting,
  onCancel,
  onExport,
}: TableExportDialogProps) {
  const [step, setStep] = useState(0)
  const [selectedNames, setSelectedNames] = useState<string[]>([])
  const [columnsByObject, setColumnsByObject] = useState<
    Record<string, string[]>
  >({})
  const [options, setOptions] = useState<
    Omit<TableExportOptions, 'columns'>
  >(createTableExportOptions())

  useEffect(() => {
    if (!open) return
    setStep(0)
    setSelectedNames(initialObjectNames(objects, initialSelection))
    setColumnsByObject(Object.fromEntries(
      objects.map(object => [object.name, object.columns]),
    ))
    setOptions(createTableExportOptions())
  }, [initialSelection, objects, open])

  const selectedObjects = useMemo(
    () => objects
      .filter(object => selectedNames.includes(object.name))
      .map(object => ({
        name: object.name,
        objectType: object.objectType,
        columns: columnsByObject[object.name] || [],
      })),
    [columnsByObject, objects, selectedNames],
  )

  const continueFromContent = () => {
    if (selectedObjects.length === 0) {
      message.warning('请至少选择一个导出对象')
      return
    }
    const emptyObject = selectedObjects.find(item => item.columns.length === 0)
    if (emptyObject) {
      message.warning(`请为对象“${emptyObject.name}”选择至少一个字段`)
      return
    }
    setStep(1)
  }

  const submit = async () => {
    await onExport({ objects: selectedObjects, options })
  }

  const footer = step === 0
    ? [
      <Button key="cancel" onClick={onCancel}>取消</Button>,
      <Button key="next" type="primary" onClick={continueFromContent}>
        下一步
      </Button>,
    ]
    : step === 1
      ? [
        <Button key="back" onClick={() => setStep(0)}>上一步</Button>,
        <Button key="next" type="primary" onClick={() => setStep(2)}>
          下一步
        </Button>,
      ]
      : [
        <Button key="back" disabled={exporting} onClick={() => setStep(1)}>
          上一步
        </Button>,
        <Button
          key="export"
          type="primary"
          loading={exporting}
          onClick={() => void submit()}
        >
          导出
        </Button>,
      ]

  const objectLabel = objects[0]?.objectType === 'view' ? '视图' : '表'

  return (
    <Modal
      open={open}
      width={980}
      title={`导出向导：${objectLabel}`}
      footer={footer}
      onCancel={onCancel}
      maskClosable={false}
      keyboard={!exporting}
      destroyOnClose
      className="table-export-modal"
    >
      <Steps
        size="small"
        current={step}
        items={[
          { title: '对象与字段' },
          { title: '文件格式' },
          { title: '确认导出' },
        ]}
      />

      {step === 0 && (
        <TableExportContentStep
          objects={objects}
          selectedNames={selectedNames}
          columnsByObject={columnsByObject}
          onSelectedNamesChange={setSelectedNames}
          onColumnsChange={(name, columns) => setColumnsByObject(
            previous => ({ ...previous, [name]: columns }),
          )}
        />
      )}
      {step === 1 && (
        <TableExportFormatStep value={options} onChange={setOptions} />
      )}
      {step === 2 && (
        <TableExportReviewStep
          databaseType={databaseType}
          objects={selectedObjects}
          options={options}
        />
      )}
    </Modal>
  )
}
