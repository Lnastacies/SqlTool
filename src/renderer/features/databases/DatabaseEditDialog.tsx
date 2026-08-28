import React, { useEffect, useMemo, useState } from 'react'
import { Button, Form, Input, Modal, Select, message } from 'antd'
import SaveOutlined from '@ant-design/icons/SaveOutlined'
import type {
  AlterDatabaseRequest,
  ConnectionData,
  DatabaseEncodingCatalog,
} from '../../types'
import {
  mysqlCharsetOptions,
  mysqlCollationOptions,
  mysqlDefaultCollation,
} from './createDatabaseEncodingOptions'

interface DatabaseEditDialogProps {
  connection: ConnectionData
  database: string
  onClose: () => void
  onSave: (request: AlterDatabaseRequest) => Promise<void>
}

export default function DatabaseEditDialog({
  connection,
  database,
  onClose,
  onSave,
}: DatabaseEditDialogProps) {
  const [form] = Form.useForm<AlterDatabaseRequest>()
  const [saving, setSaving] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [encodingCatalog, setEncodingCatalog] = useState<
    DatabaseEncodingCatalog
  >()
  const mysql = connection.type === 'MySQL'
  const charset = Form.useWatch('charset', form)
  const collation = Form.useWatch('collation', form)
  const charsetOptions = useMemo(
    () => mysqlCharsetOptions(encodingCatalog, charset),
    [charset, encodingCatalog],
  )
  const collationOptions = useMemo(
    () => mysqlCollationOptions(charset, encodingCatalog, collation),
    [charset, collation, encodingCatalog],
  )

  useEffect(() => {
    if (!mysql) return
    let active = true
    setCatalogLoading(true)
    void window.logger.write(
      'info',
      'DatabaseEditDialog',
      `开始加载数据库当前编码: 连接=${connection.id}, 数据库=${database}`,
    )
    void window.database.getDatabaseEncodingCatalog(
      connection.id,
      database,
    ).then(result => {
      if (!active) return
      if (!result.success || !result.data) {
        const detail = result.error?.detail
          || result.error?.message
          || '未知错误'
        void window.logger.write(
          'error',
          'DatabaseEditDialog',
          `数据库当前编码加载失败: 连接=${connection.id}, 数据库=${database}, 原因=${detail}`,
        )
        message.error(`读取数据库当前编码失败: ${detail}`)
        return
      }
      setEncodingCatalog(result.data)
      form.setFieldsValue({
        charset: result.data.charset || connection.charset || 'utf8mb4',
        collation: result.data.collation,
      })
      void window.logger.write(
        'info',
        'DatabaseEditDialog',
        `数据库当前编码加载完成: 连接=${connection.id}, 数据库=${database}, 字符集=${result.data.charset || '无'}, 排序规则=${result.data.collation || '无'}, 可选字符集=${result.data.charsets.length}`,
      )
    }).finally(() => {
      if (active) setCatalogLoading(false)
    })
    return () => {
      active = false
    }
  }, [connection.charset, connection.id, database, form, mysql])

  const save = async () => {
    try {
      const values = await form.validateFields()
      const request: AlterDatabaseRequest = mysql
        ? {
          charset: values.charset?.trim(),
          collation: values.collation?.trim(),
        }
        : { name: values.name?.trim() }
      if (mysql && !request.charset && !request.collation) {
        throw new Error('请至少填写默认字符集或默认排序规则')
      }
      setSaving(true)
      await onSave(request)
      onClose()
    } catch (error) {
      if (error instanceof Error) message.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      className="database-management-dialog"
      title={`编辑数据库 - ${database}`}
      open
      width={520}
      maskClosable={false}
      destroyOnHidden
      onCancel={onClose}
      footer={[
        <Button key="cancel" disabled={saving} onClick={onClose}>取消</Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          disabled={catalogLoading}
          onClick={() => void save()}
        >
          保存
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={mysql
          ? {
            charset: connection.charset || 'utf8mb4',
            collation: undefined,
          }
          : { name: database }}
      >
        {mysql ? (
          <>
            <Form.Item
              name="charset"
              label="默认字符集"
              rules={[{
                pattern: /^[A-Za-z0-9_]*$/,
                message: '字符集只能包含字母、数字和下划线',
              }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                loading={catalogLoading}
                options={charsetOptions}
                placeholder="请选择默认字符集"
                autoFocus
                onChange={value => {
                  const options = mysqlCollationOptions(
                    value,
                    encodingCatalog,
                  )
                  const current = form.getFieldValue('collation')
                  if (!options.some(option => option.value === current)) {
                    form.setFieldValue(
                      'collation',
                      mysqlDefaultCollation(value, encodingCatalog),
                    )
                  }
                }}
              />
            </Form.Item>
            <Form.Item
              name="collation"
              label="默认排序规则"
              rules={[{
                pattern: /^[A-Za-z0-9_]*$/,
                message: '排序规则只能包含字母、数字和下划线',
              }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                loading={catalogLoading}
                options={collationOptions}
                placeholder="请选择默认排序规则"
              />
            </Form.Item>
          </>
        ) : (
          <Form.Item
            name="name"
            label="数据库名称"
            rules={[{
              required: true,
              whitespace: true,
              message: '请输入数据库名称',
            }]}
          >
            <Input autoFocus maxLength={128} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
