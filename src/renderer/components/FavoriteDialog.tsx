import React, { useCallback, useEffect, useState } from 'react'
import {
  Empty,
  List,
  message,
  Modal,
  Popconfirm,
  Tag,
} from 'antd'
import DeleteOutlined from '@ant-design/icons/DeleteOutlined'

/**
 * 收藏项数据结构，与后端 favoriteStore.Favorite 对应。
 */
export interface FavoriteItem {
  id: string
  name: string
  connId: string
  connectionName: string
  database: string
  objectName?: string
  objectType?: 'table' | 'view' | 'function' | 'event' | 'procedure'
  createdAt: string
}

interface FavoriteDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (item: FavoriteItem) => void
}

/**
 * 收藏夹管理对话框。
 * 列出所有收藏项，支持定位到对象和删除收藏。
 */
export default function FavoriteDialog({
  open,
  onClose,
  onSelect,
}: FavoriteDialogProps) {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(false)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.favorite.list()
      if (result.success) {
        setItems(result.data || [])
      } else {
        message.error(result.error?.message || '加载收藏夹失败')
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`加载收藏夹失败：${detail}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void loadItems()
  }, [open, loadItems])

  const handleDelete = async (id: string) => {
    try {
      const result = await window.favorite.delete(id)
      if (!result.success) {
        throw new Error(result.error?.message || '删除收藏失败')
      }
      void window.logger.write('info', 'Favorite', `删除收藏: ID=${id}`)
      await loadItems()
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      message.error(`删除收藏失败：${detail}`)
    }
  }

  const handleSelect = (item: FavoriteItem) => {
    onSelect(item)
    onClose()
  }

  return (
    <Modal
      title="收藏夹管理"
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnHidden
    >
      {items.length === 0 && !loading ? (
        <Empty description="暂无收藏，请在对象上右键选择「添加到收藏夹」" />
      ) : (
        <List
          loading={loading}
          dataSource={items}
          renderItem={item => (
            <List.Item
              actions={[
                <Popconfirm
                  key="delete"
                  title="确定删除此收藏吗？"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => handleDelete(item.id)}
                >
                  <button
                    type="button"
                    aria-label="删除收藏"
                    title="删除收藏"
                    className="favorite-item-action"
                  >
                    <DeleteOutlined />
                  </button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <button
                    type="button"
                    className="favorite-item-title"
                    onClick={() => handleSelect(item)}
                    title="点击定位到对象"
                  >
                    {item.name}
                  </button>
                }
                description={
                  <span className="favorite-item-detail">
                    {item.objectType && <Tag>{item.objectType}</Tag>}
                    <span>{item.connectionName}</span>
                    <span> / </span>
                    <span>{item.database}</span>
                    {item.objectName && (
                      <>
                        <span> / </span>
                        <span>{item.objectName}</span>
                      </>
                    )}
                  </span>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Modal>
  )
}
