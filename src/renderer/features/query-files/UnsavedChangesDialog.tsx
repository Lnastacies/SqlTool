import React from 'react'
import { Button, Modal } from 'antd'
import type { WorkspaceDocument } from '../../workspace/workspaceTypes'

export type CloseDecision = 'save' | 'discard' | 'cancel'

interface UnsavedChangesDialogProps {
  document?: WorkspaceDocument
  onDecision: (decision: CloseDecision) => void
}

export default function UnsavedChangesDialog({
  document,
  onDecision,
}: UnsavedChangesDialogProps) {
  const canSave = document?.kind === 'query'

  return (
    <Modal
      open={Boolean(document)}
      title={`保存对“${document?.name || ''}”的更改？`}
      width={430}
      closable={false}
      maskClosable={false}
      keyboard={false}
      onCancel={() => onDecision('cancel')}
      footer={[
        <Button
          key="discard"
          onClick={() => onDecision('discard')}
        >
          不保存
        </Button>,
        <Button
          key="cancel"
          onClick={() => onDecision('cancel')}
        >
          取消
        </Button>,
        canSave && (
          <Button
            key="save"
            type="primary"
            onClick={() => onDecision('save')}
          >
            保存
          </Button>
        ),
      ]}
    >
      <p className="unsaved-changes-dialog__message">
        {canSave
          ? '关闭后，未保存的 SQL 修改将会丢失。'
          : '当前数据修改尚未提交，关闭后修改将会丢失。'}
      </p>
    </Modal>
  )
}
