import React, { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Empty,
  Form,
  Input,
  List,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
} from 'antd'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'
import PlayCircleOutlined from '@ant-design/icons/PlayCircleOutlined'
import PlusOutlined from '@ant-design/icons/PlusOutlined'

const { TextArea } = Input

interface AutomationDialogProps {
  open: boolean
  onClose: () => void
  /** 打开查询文档执行配置中的 SQL，返回 false 表示执行失败，不关闭对话框 */
  onExecute: (config: AutomationConfig) => boolean
  /** 当前选中的连接 ID，用于创建配置时保存上下文 */
  currentConnId?: string
  /** 当前选中的数据库，用于创建配置时保存上下文 */
  currentDatabase?: string
}

/**
 * 自动运行配置项。
 * 注意：当前版本仅支持保存配置和手动执行，定时调度计划在后续版本实现。
 */
export interface AutomationConfig {
  id: string
  name: string
  sql: string
  schedule: 'manual' | 'hourly' | 'daily' | 'weekly'
  connId?: string
  database?: string
  createdAt: string
}

const SCHEDULE_LABELS: Record<AutomationConfig['schedule'], string> = {
  manual: '手动',
  hourly: '每小时',
  daily: '每天',
  weekly: '每周',
}

/**
 * 从 localStorage 加载配置，避免引入后端存储复杂度。
 * 自动运行配置数量通常较少，localStorage 足够。
 */
function loadConfigs(): AutomationConfig[] {
  try {
    const raw = localStorage.getItem('sqltool.automation.configs')
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveConfigs(configs: AutomationConfig[]): void {
  localStorage.setItem('sqltool.automation.configs', JSON.stringify(configs))
}

/**
 * 自动运行配置对话框。
 * 允许保存 SQL 配置并设置调度计划，当前版本支持手动执行，
 * 定时调度需后端调度器支持，计划在后续版本实现。
 */
export default function AutomationDialog({
  open,
  onClose,
  onExecute,
  currentConnId,
  currentDatabase,
}: AutomationDialogProps) {
  const [configs, setConfigs] = useState<AutomationConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const items = loadConfigs()
      setConfigs(items)
      void window.logger.write(
        'info',
        'Automation',
        `加载自动运行配置: 数量=${items.length}`,
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`加载配置失败：${detail}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      const config: AutomationConfig = {
        id: `auto-${Date.now()}`,
        name: values.name,
        sql: values.sql,
        schedule: values.schedule || 'manual',
        connId: currentConnId,
        database: currentDatabase,
        createdAt: new Date().toISOString(),
      }
      const next = [...configs, config]
      setConfigs(next)
      saveConfigs(next)
      void window.logger.write(
        'info',
        'Automation',
        `创建配置: 名称=${config.name}, 调度=${config.schedule}`,
      )
      message.success(`配置「${config.name}」已保存`)
      form.resetFields()
      setCreateOpen(false)
    } catch (err) {
      if (err instanceof Error && err.message.includes('validate')) return
      const detail = err instanceof Error ? err.message : String(err)
      message.error(`创建配置失败：${detail}`)
    }
  }

  const handleDelete = (config: AutomationConfig) => {
    const next = configs.filter(item => item.id !== config.id)
    setConfigs(next)
    saveConfigs(next)
    void window.logger.write(
      'info',
      'Automation',
      `删除配置: ID=${config.id}, 名称=${config.name}`,
    )
    message.success(`配置「${config.name}」已删除`)
  }

  const handleExecute = (config: AutomationConfig) => {
    // 执行配置，仅在成功时关闭对话框
    const success = onExecute(config)
    if (success) {
      onClose()
    }
  }

  // 外层对话框关闭时重置内层表单状态，避免下次打开时残留
  const handleClose = () => {
    setCreateOpen(false)
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title="自动运行"
      open={open}
      width={720}
      destroyOnHidden
      onCancel={handleClose}
      footer={<Button onClick={handleClose}>关闭</Button>}
    >
      <Space style={{ marginBottom: 12 }}>
        <Button
          icon={<PlusOutlined />}
          size="small"
          onClick={() => setCreateOpen(true)}
        >
          新建配置
        </Button>
        <Button size="small" onClick={() => void load()}>
          刷新
        </Button>
        <Tag color="orange">定时调度待实现</Tag>
      </Space>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : configs.length === 0 ? (
        <Empty description="暂无自动运行配置，点击「新建配置」创建" />
      ) : (
        <List
          dataSource={configs}
          renderItem={config => (
            <List.Item
              actions={[
                <button
                  key="execute"
                  type="button"
                  className="favorite-item-action"
                  title="立即执行"
                  onClick={() => handleExecute(config)}
                >
                  <PlayCircleOutlined />
                </button>,
                <Popconfirm
                  key="delete"
                  title="确定删除此配置吗？"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => handleDelete(config)}
                >
                  <button
                    type="button"
                    className="favorite-item-action"
                    title="删除配置"
                  >
                    <DeleteOutlined />
                  </button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <span>
                    {config.name}
                    <Tag style={{ marginLeft: 8 }}>
                      {SCHEDULE_LABELS[config.schedule]}
                    </Tag>
                  </span>
                }
                description={
                  <span>
                    {config.database && (
                      <Tag color="blue" style={{ marginRight: 8 }}>
                        {config.database}
                      </Tag>
                    )}
                    <span className="automation-config-sql">
                      {config.sql.slice(0, 100)}
                      {config.sql.length > 100 ? '...' : ''}
                    </span>
                  </span>
                }
              />
            </List.Item>
          )}
        />
      )}

      <Modal
        title="新建自动运行配置"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="例如：每日清理日志" autoFocus />
          </Form.Item>
          <Form.Item name="schedule" label="调度计划" initialValue="manual">
            <Select
              options={[
                { value: 'manual', label: '手动执行' },
                { value: 'hourly', label: '每小时（待实现）', disabled: true },
                { value: 'daily', label: '每天（待实现）', disabled: true },
                { value: 'weekly', label: '每周（待实现）', disabled: true },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="sql"
            label="SQL 语句"
            rules={[{ required: true, message: '请输入 SQL 语句' }]}
          >
            <TextArea
              rows={6}
              placeholder="输入需要自动执行的 SQL 语句"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Modal>
  )
}
