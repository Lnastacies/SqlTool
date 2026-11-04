import React, { useState } from 'react'
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  message,
} from 'antd'
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined'
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined'
import SaveOutlined from '@ant-design/icons/SaveOutlined'
import { isMySQLCompatible } from '../features/mysqlCompat'
import type {
  ConnectionData,
  ConnectionDraft,
  ConnectionGroup,
  DatabaseType,
} from '../types'
import {
  mysqlCharsetOptions,
} from '../features/databases/createDatabaseEncodingOptions'

interface ConnectionDialogProps {
  connection?: ConnectionData
  initialDraft?: ConnectionDraft
  defaultGroupId?: string
  groups: ConnectionGroup[]
  onClose: () => void
  onSave: (draft: ConnectionDraft, connectAfterSave: boolean) => Promise<void>
  onTest: (
    draft: ConnectionDraft,
  ) => Promise<{ success: boolean; message: string }>
}

const databaseTypes = [
  { value: 'MySQL', label: 'MySQL' },
  { value: 'PostgreSQL', label: 'PostgreSQL' },
  { value: 'SQL Server', label: 'SQL Server' },
  { value: 'SQLite', label: 'SQLite' },
]

// TDSQL 不在新建连接类型下拉中（连接经配置导入产生），此处仅为类型完整性补全，
// 默认端口与主进程 connectionConfigMigration 的 defaultPort 保持一致
const defaultPorts: Record<DatabaseType, number> = {
  MySQL: 3306,
  TDSQL: 3306,
  PostgreSQL: 5432,
  'SQL Server': 1433,
  SQLite: 0,
}

function ConnectionDialog({
  connection,
  initialDraft,
  defaultGroupId,
  groups,
  onClose,
  onSave,
  onTest,
}: ConnectionDialogProps) {
  const [form] = Form.useForm<ConnectionDraft>()
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const type = Form.useWatch('type', form) || connection?.type || 'MySQL'
  const editing = Boolean(connection)

  const readDraft = async (): Promise<ConnectionDraft> => {
    const values = await form.validateFields()
    const sqlite = values.type === 'SQLite'
    const database = sqlite || editing
      ? (values.database || '').trim()
      : ''
    return {
      ...values,
      groupId: values.groupId || undefined,
      host: sqlite ? '' : values.host.trim(),
      port: sqlite ? 0 : Number(values.port),
      username: sqlite ? '' : values.username.trim(),
      password: values.password || '',
      // 新建服务端连接固定为服务器级，具体数据库在连接后从左侧树选择。
      database,
      timeout: Number(values.timeout || 30),
      charset: values.type === 'MySQL'
        ? values.charset?.trim() || 'utf8mb4'
        : undefined,
      color: connection?.color || initialDraft?.color,
    }
  }

  const handleTest = async () => {
    try {
      const draft = await readDraft()
      setTesting(true)
      const result = await onTest(draft)
      if (result.success) message.success(result.message)
      else message.error(result.message)
    } catch (error) {
      if (error instanceof Error) message.error(error.message)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async (connectAfterSave: boolean) => {
    try {
      const draft = await readDraft()
      setSaving(true)
      await onSave(draft, connectAfterSave)
      message.success(editing ? '连接已更新' : '连接已保存')
      onClose()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存连接失败')
    } finally {
      setSaving(false)
    }
  }

  const initialValues: ConnectionDraft = connection
    ? {
      ...connection,
      groupId: connection.groupId || undefined,
      charset: connection.charset || 'utf8mb4',
    }
    : initialDraft
      ? {
        ...initialDraft,
        groupId: initialDraft.groupId || undefined,
        charset: initialDraft.charset || 'utf8mb4',
      }
    : {
      name: '',
      type: 'MySQL',
      groupId: defaultGroupId,
      host: 'localhost',
      port: defaultPorts.MySQL,
      username: 'root',
      password: '',
      database: '',
      timeout: 30,
      charset: 'utf8mb4',
    }
  const charsetOptions = mysqlCharsetOptions(
    undefined,
    initialValues.charset,
  )

  return (
    <Modal
      className="connection-dialog"
      title={(
        <span className="connection-dialog__title">
          <DatabaseOutlined />
          {editing ? '编辑连接' : '新建连接'}
        </span>
      )}
      open
      onCancel={onClose}
      width={560}
      destroyOnHidden
      maskClosable={false}
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button
          key="test"
          icon={<CheckCircleOutlined />}
          loading={testing}
          disabled={saving}
          onClick={() => void handleTest()}
        >
          测试连接
        </Button>,
        !editing && (
          <Button
            key="save-only"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={testing}
            onClick={() => void handleSave(false)}
          >
            仅保存
          </Button>
        ),
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          disabled={testing}
          onClick={() => void handleSave(!editing)}
        >
          {editing ? '保存' : '保存并连接'}
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        size="middle"
        initialValues={initialValues}
      >
        <div className="connection-dialog__grid">
          <Form.Item
            name="name"
            label="连接名称"
            rules={[{ required: true, whitespace: true, message: '请输入连接名称' }]}
          >
            <Input placeholder="例如：生产库（只读）" autoFocus />
          </Form.Item>
          <Form.Item name="groupId" label="所属分组">
            <Select
              allowClear
              placeholder="未分组"
              options={groups.map(group => ({
                value: group.id,
                label: group.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="type"
            label="数据库类型"
            rules={[{ required: true, message: '请选择数据库类型' }]}
          >
            <Select
              options={databaseTypes}
              onChange={(value: DatabaseType) => {
                form.setFieldsValue({
                  port: defaultPorts[value],
                  database: '',
                  charset: isMySQLCompatible(value) ? 'utf8mb4' : undefined,
                })
              }}
            />
          </Form.Item>
          {type === 'SQLite' || editing ? (
            <Form.Item
              name="database"
              label={type === 'SQLite' ? '数据库文件' : '默认数据库'}
              rules={type === 'SQLite'
                ? [{ required: true, whitespace: true, message: '请输入 SQLite 文件路径' }]
                : undefined}
            >
              <Input placeholder={type === 'SQLite' ? 'D:\\data\\example.db' : '可选'} />
            </Form.Item>
          ) : (
            <Form.Item label="连接范围">
              <div className="connection-dialog__scope">
                服务器级连接，建立连接后再选择数据库
              </div>
            </Form.Item>
          )}
        </div>

        {type !== 'SQLite' && (
          <>
            <div className="connection-dialog__host-row">
              <Form.Item
                name="host"
                label="主机"
                rules={[{ required: true, whitespace: true, message: '请输入主机地址' }]}
              >
                <Input placeholder="localhost" />
              </Form.Item>
              <Form.Item
                name="port"
                label="端口"
                rules={[{ required: true, message: '请输入端口' }]}
              >
                <InputNumber min={1} max={65535} precision={0} />
              </Form.Item>
            </div>
            <div className="connection-dialog__grid">
              <Form.Item name="username" label="用户名">
                <Input autoComplete="username" />
              </Form.Item>
              <Form.Item name="password" label="密码">
                <Input.Password autoComplete="new-password" />
              </Form.Item>
            </div>
          </>
        )}

        <div className="connection-dialog__grid connection-dialog__advanced">
          <Form.Item name="timeout" label="连接超时（秒）">
            <InputNumber min={1} max={300} precision={0} />
          </Form.Item>
          <Form.Item name="charset" label="字符集">
            <Select
              showSearch
              optionFilterProp="label"
              options={charsetOptions}
              disabled={type !== 'MySQL'}
              placeholder={type === 'MySQL' ? '请选择字符集' : '当前类型不适用'}
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

export default ConnectionDialog
