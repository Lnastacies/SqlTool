import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  List,
  message,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
} from 'antd'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'
import PlusOutlined from '@ant-design/icons/PlusOutlined'
import type { ConnectionData } from '../../types'

interface UserManagementDialogProps {
  connection: ConnectionData
  database: string
  onClose: () => void
}

interface DatabaseUser {
  name: string
  host?: string
  detail?: string
}

/**
 * 根据数据库类型构建查询用户列表的 SQL。
 * - MySQL：查询 mysql.user 系统表
 * - PostgreSQL：查询 pg_user 系统视图
 * - SQL Server：查询 sys.database_principals 系统视图
 * - SQLite：不支持用户管理，返回空
 */
function buildListUsersSql(type: ConnectionData['type']): string {
  if (type === 'MySQL') {
    return 'SELECT User, Host FROM mysql.user ORDER BY User'
  }
  if (type === 'PostgreSQL') {
    return 'SELECT usename FROM pg_user ORDER BY usename'
  }
  if (type === 'SQL Server') {
    return "SELECT name FROM sys.database_principals WHERE type IN ('S','U') ORDER BY name"
  }
  return ''
}

/**
 * 解析用户列表查询结果，统一为 { name, host, detail } 结构。
 */
function parseUserRows(
  type: ConnectionData['type'],
  columns: string[],
  rows: any[],
): DatabaseUser[] {
  return rows.map(row => {
    if (type === 'MySQL') {
      const user = String(row.User ?? row.user ?? '')
      const host = String(row.Host ?? row.host ?? '')
      return { name: user, host, detail: `${user}@${host}` }
    }
    if (type === 'PostgreSQL') {
      const name = String(row.usename ?? '')
      return { name, detail: name }
    }
    if (type === 'SQL Server') {
      const name = String(row.name ?? '')
      return { name, detail: name }
    }
    return { name: String(row), detail: String(row) }
  })
}

/**
 * 构建创建用户的 SQL 语句。
 * MySQL 需要指定 host，PostgreSQL/SQL Server 仅需用户名和密码。
 */
function buildCreateUserSql(
  type: ConnectionData['type'],
  userName: string,
  password: string,
  host: string,
): string {
  const safeName = userName.replace(/[;`"'\[\]]/g, '')
  const safePassword = password.replace(/'/g, "''")
  if (type === 'MySQL') {
    const safeHost = host || '%'
    return `CREATE USER '${safeName}'@'${safeHost}' IDENTIFIED BY '${safePassword}';`
  }
  if (type === 'PostgreSQL') {
    return `CREATE USER "${safeName}" WITH PASSWORD '${safePassword}';`
  }
  if (type === 'SQL Server') {
    return `CREATE LOGIN "${safeName}" WITH PASSWORD = '${safePassword}';`
  }
  return ''
}

/**
 * 构建删除用户的 SQL 语句。
 */
function buildDropUserSql(
  type: ConnectionData['type'],
  userName: string,
  host?: string,
): string {
  const safeName = userName.replace(/[;`"'\[\]]/g, '')
  if (type === 'MySQL') {
    const safeHost = host || '%'
    return `DROP USER IF EXISTS '${safeName}'@'${safeHost}';`
  }
  if (type === 'PostgreSQL') {
    return `DROP USER IF EXISTS "${safeName}";`
  }
  if (type === 'SQL Server') {
    return `DROP LOGIN "${safeName}";`
  }
  return ''
}

/**
 * 数据库用户管理对话框。
 * 支持查看用户列表、创建用户、删除用户。
 * 权限管理请通过查询窗口手动执行 GRANT/REVOKE 语句。
 */
export default function UserManagementDialog({
  connection,
  database,
  onClose,
}: UserManagementDialogProps) {
  const [users, setUsers] = useState<DatabaseUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()

  const supported = connection.type !== 'SQLite'

  const loadUsers = useCallback(async () => {
    if (!supported) return
    setLoading(true)
    setError('')
    try {
      const sql = buildListUsersSql(connection.type)
      const result = await window.database.executeSQL(
        connection.id,
        database,
        sql,
      )
      if (!result.success || !result.data) {
        throw new Error(result.error?.message || '查询用户列表失败')
      }
      const parsed = parseUserRows(
        connection.type,
        result.data.columns || [],
        result.data.rows || [],
      )
      setUsers(parsed)
      void window.logger.write(
        'info',
        'UserManagement',
        `加载用户列表: 连接=${connection.id}, 类型=${connection.type}, 用户数=${parsed.length}`,
      )
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      setError(detail)
      void window.logger.write(
        'error',
        'UserManagement',
        `加载用户列表失败: 连接=${connection.id}, 原因=${detail}`,
      )
    } finally {
      setLoading(false)
    }
  }, [connection.id, connection.type, database, supported])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      const sql = buildCreateUserSql(
        connection.type,
        values.userName,
        values.password,
        values.host || '',
      )
      const result = await window.database.executeSQL(
        connection.id,
        database,
        sql,
      )
      if (!result.success) {
        throw new Error(result.error?.message || '创建用户失败')
      }
      void window.logger.write(
        'info',
        'UserManagement',
        `创建用户: 连接=${connection.id}, 用户=${values.userName}`,
      )
      message.success(`用户「${values.userName}」已创建`)
      form.resetFields()
      setCreateOpen(false)
      await loadUsers()
    } catch (err) {
      if (err instanceof Error && err.message.includes('validate')) return
      const detail = err instanceof Error ? err.message : String(err)
      message.error(`创建用户失败：${detail}`)
    }
  }

  const handleDelete = async (user: DatabaseUser) => {
    try {
      const sql = buildDropUserSql(connection.type, user.name, user.host)
      const result = await window.database.executeSQL(
        connection.id,
        database,
        sql,
      )
      if (!result.success) {
        throw new Error(result.error?.message || '删除用户失败')
      }
      void window.logger.write(
        'info',
        'UserManagement',
        `删除用户: 连接=${connection.id}, 用户=${user.detail}`,
      )
      message.success(`用户「${user.detail}」已删除`)
      await loadUsers()
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      message.error(`删除用户失败：${detail}`)
    }
  }

  return (
    <Modal
      title={`用户管理 - ${connection.name}`}
      open
      width={680}
      destroyOnHidden
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      {!supported ? (
        <Alert
          type="info"
          showIcon
          message="SQLite 不支持数据库用户管理"
          description="SQLite 通过文件系统权限控制访问，没有数据库级用户概念。"
        />
      ) : (
        <>
          <Space style={{ marginBottom: 12 }}>
            <Button
              icon={<PlusOutlined />}
              size="small"
              onClick={() => setCreateOpen(true)}
            >
              新建用户
            </Button>
            <Button size="small" onClick={() => void loadUsers()}>
              刷新
            </Button>
            <Tag color="blue">{connection.type}</Tag>
          </Space>
          {loading && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          )}
          {error && <Alert type="error" showIcon message={error} />}
          {!loading && !error && users.length === 0 ? (
            <Empty description="未查询到用户" />
          ) : (
            <List
              dataSource={users}
              renderItem={user => (
                <List.Item
                  actions={[
                    <Popconfirm
                      key="delete"
                      title={`确定删除用户「${user.detail}」吗？`}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => handleDelete(user)}
                    >
                      <button
                        type="button"
                        aria-label="删除用户"
                        title="删除用户"
                        className="favorite-item-action"
                      >
                        <DeleteOutlined />
                      </button>
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={user.name}
                    description={
                      <span>
                        {user.host && <Tag>host: {user.host}</Tag>}
                        <span>{user.detail}</span>
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </>
      )}

      <Modal
        title="新建用户"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="userName"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="输入用户名" autoFocus />
          </Form.Item>
          {connection.type === 'MySQL' && (
            <Form.Item name="host" label="主机">
              <Input placeholder="允许连接的主机，默认 %" />
            </Form.Item>
          )}
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="输入密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Modal>
  )
}
