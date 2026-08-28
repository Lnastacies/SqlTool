import { useState, useEffect } from 'react'
import { List, Input, Button, Popconfirm, Empty, Tag, Tooltip, Select, Modal, Form } from 'antd'
import { SearchOutlined, CopyOutlined, PlayCircleOutlined, DeleteOutlined, PlusOutlined, EditOutlined, FolderOutlined } from '@ant-design/icons'

interface Snippet {
  id: string
  name: string
  category: string
  description: string
  sql: string
  variables?: { name: string; defaultValue: string }[]
  createdAt: string
  updatedAt: string
}

interface SnippetPanelProps {
  onInsertSQL: (sql: string) => void
}

export default function SnippetPanel({ onInsertSQL }: SnippetPanelProps) {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [searchText, setSearchText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadSnippets()
    loadCategories()
  }, [])

  const loadSnippets = async () => {
    setLoading(true)
    try {
      const result = await (window as any).snippet.get(searchText, selectedCategory)
      const data = result && result.success ? result.data : []
      setSnippets(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('加载代码片段失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const result = await (window as any).snippet.getCategories()
      const data = result && result.success ? result.data : []
      setCategories(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('加载分类失败:', error)
    }
  }

  const handleSearch = (value: string) => {
    setSearchText(value)
  }

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value)
  }

  const handleCopySQL = (sql: string) => {
    navigator.clipboard.writeText(sql)
  }

  const handleInsertSQL = async (snippet: Snippet) => {
    if (snippet.variables && snippet.variables.length > 0) {
      const variableValues: { [key: string]: string } = {}
      snippet.variables.forEach(v => {
        variableValues[v.name] = v.defaultValue
      })
      try {
        const result = await (window as any).snippet.replaceVariables(snippet.sql, variableValues)
        const finalSql = result && result.success ? result.data : snippet.sql
        onInsertSQL(finalSql)
      } catch (e) {
        onInsertSQL(snippet.sql)
      }
    } else {
      onInsertSQL(snippet.sql)
    }
  }

  const handleDeleteSnippet = async (id: string) => {
    try {
      await (window as any).snippet.delete(id)
      loadSnippets()
    } catch (error) {
      console.error('删除代码片段失败:', error)
    }
  }

  const handleOpenModal = (snippet?: Snippet) => {
    if (snippet) {
      setEditingSnippet(snippet)
      form.setFieldsValue({
        name: snippet.name,
        category: snippet.category,
        description: snippet.description,
        sql: snippet.sql,
        variables: snippet.variables ? JSON.stringify(snippet.variables, null, 2) : ''
      })
    } else {
      setEditingSnippet(null)
      form.resetFields()
    }
    setShowModal(true)
  }

  const handleSaveSnippet = async () => {
    try {
      const values = await form.validateFields()
      let variables: { name: string; defaultValue: string }[] = []
      if (values.variables) {
        try {
          variables = JSON.parse(values.variables)
        } catch {
          variables = []
        }
      }

      const snippetData = {
        name: values.name,
        category: values.category,
        description: values.description,
        sql: values.sql,
        variables: variables.length > 0 ? variables : undefined
      }

      if (editingSnippet) {
        await (window as any).snippet.update(editingSnippet.id, snippetData)
      } else {
        await (window as any).snippet.add(snippetData)
      }

      setShowModal(false)
      loadSnippets()
      loadCategories()
    } catch (error) {
      console.error('保存代码片段失败:', error)
    }
  }

  const formatSQLPreview = (sql: string) => {
    const preview = sql.replace(/\n/g, ' ').trim()
    return preview.length > 80 ? preview.substring(0, 80) + '...' : preview
  }

  return (
    <div className="snippet-panel">
      <div className="panel-header">
        <div className="header-left">
          <span className="header-icon">📝</span>
          <span className="header-title">代码片段</span>
        </div>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          添加
        </Button>
      </div>

      <div className="search-bar">
        <Input.Search
          placeholder="搜索代码片段..."
          allowClear
          value={searchText}
          onChange={(e) => handleSearch(e.target.value)}
          onSearch={loadSnippets}
          prefix={<SearchOutlined />}
          size="small"
        />
      </div>

      <div className="category-filter">
        <Select
          style={{ width: '100%' }}
          placeholder="选择分类"
          value={selectedCategory}
          onChange={handleCategoryChange}
          allowClear
          size="small"
        >
          {categories.map(cat => (
            <Select.Option key={cat} value={cat}>
              <FolderOutlined style={{ marginRight: 4 }} />
              {cat}
            </Select.Option>
          ))}
        </Select>
      </div>

      <div className="snippet-list">
        <List
          loading={loading}
          dataSource={snippets}
          renderItem={(item) => (
            <List.Item
              className="snippet-item"
              actions={[
                <Tooltip title="复制SQL">
                  <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopySQL(item.sql)} />
                </Tooltip>,
                <Tooltip title="插入到编辑器">
                  <Button type="text" size="small" icon={<PlayCircleOutlined />} onClick={() => handleInsertSQL(item)} />
                </Tooltip>,
                <Tooltip title="编辑">
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(item)} />
                </Tooltip>,
                <Tooltip title="删除">
                  <Popconfirm
                    title="确定删除这条代码片段？"
                    onConfirm={() => handleDeleteSnippet(item.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Tooltip>,
              ]}
            >
              <div className="snippet-content">
                <div className="snippet-header">
                  <span className="snippet-name">{item.name}</span>
                  <Tag color="blue">{item.category}</Tag>
                </div>
                <div className="snippet-description">{item.description}</div>
                <div className="snippet-sql">{formatSQLPreview(item.sql)}</div>
                {item.variables && item.variables.length > 0 && (
                  <div className="snippet-variables">
                    <span className="variables-label">变量:</span>
                    {item.variables.map((v, i) => (
                      <span key={i} className="variable-tag">${v.name}</span>
                    ))}
                  </div>
                )}
              </div>
            </List.Item>
          )}
          locale={{ emptyText: <Empty description="暂无代码片段" /> }}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条片段`,
          }}
        />
      </div>

      <Modal
        title={editingSnippet ? '编辑代码片段' : '添加代码片段'}
        open={showModal}
        onCancel={() => setShowModal(false)}
        onOk={handleSaveSnippet}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入代码片段名称' }]}
          >
            <Input placeholder="输入代码片段名称" />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="选择分类">
              {categories.map(cat => (
                <Select.Option key={cat} value={cat}>{cat}</Select.Option>
              ))}
              <Select.Option value="自定义">自定义</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input placeholder="输入代码片段描述" />
          </Form.Item>

          <Form.Item
            name="sql"
            label="SQL内容"
            rules={[{ required: true, message: '请输入SQL内容' }]}
          >
            <Input.TextArea rows={6} placeholder="输入SQL内容，支持变量如 ${tableName}" />
          </Form.Item>

          <Form.Item
            name="variables"
            label="变量定义 (JSON格式)"
            extra='格式: [{"name": "tableName", "defaultValue": "users"}]'
          >
            <Input.TextArea rows={3} placeholder='[{"name": "tableName", "defaultValue": "users"}]' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
