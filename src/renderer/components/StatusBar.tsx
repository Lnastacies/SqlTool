import React from 'react'
import SettingOutlined from '@ant-design/icons/SettingOutlined'
import ReloadOutlined from '@ant-design/icons/ReloadOutlined'
import UnorderedListOutlined from '@ant-design/icons/UnorderedListOutlined'
import TableOutlined from '@ant-design/icons/TableOutlined'
import PictureOutlined from '@ant-design/icons/PictureOutlined'

interface StatusBarProps {
  status: {
    connection: string
    database: string
    executionTime: string
    recordCount: number
  }
}

function StatusBar({ status }: StatusBarProps) {
  return (
    <div className="sqltool-status-bar">
      <div className="status-left">
        <span className="status-item">
          <span className={status.connection.includes('已连接') ? 'status-online' : 'status-offline'}>●</span>
          <span>{status.connection}</span>
        </span>
        <span className="status-item">
          <span>数据库: {status.database}</span>
        </span>
        <span className="status-item">
          <span>执行时间: {status.executionTime}秒</span>
        </span>
        <span className="status-item">
          <span>记录数: {status.recordCount}</span>
        </span>
      </div>
      
      <div className="status-right">
        <span className="status-actions">
          <button className="status-btn" title="设置">
            <SettingOutlined />
          </button>
          <button className="status-btn" title="刷新">
            <ReloadOutlined />
          </button>
          <button className="status-btn" title="列表视图">
            <UnorderedListOutlined />
          </button>
          <button className="status-btn" title="详细视图">
            <TableOutlined />
          </button>
          <button className="status-btn" title="图标视图">
            <PictureOutlined />
          </button>
        </span>
        <span className="status-info">就绪</span>
      </div>

      <style>{`
        .sqltool-status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 12px;
          height: 100%;
          font-size: 11px;
          font-family: 'Segoe UI', 'SF Pro', Arial, sans-serif;
          background: #f0f0f0;
          border-top: 1px solid #d0d0d0;
        }
        
        .dark .sqltool-status-bar {
          background: #252526;
          border-top: 1px solid #3c3c3c;
        }
        
        .status-left {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        
        .status-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .status-item {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #333;
        }
        
        .dark .status-item {
          color: #d4d4d4;
        }
        
        .status-online {
          color: #27ae60;
          font-size: 10px;
        }
        
        .status-offline {
          color: #e74c3c;
          font-size: 10px;
        }
        
        .status-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .status-btn {
          background: transparent;
          border: none;
          padding: 2px 6px;
          cursor: pointer;
          font-size: 12px;
          color: #666;
          border-radius: 2px;
        }
        
        .dark .status-btn {
          color: #888;
        }
        
        .status-btn:hover {
          background: #e3f2fd;
          color: #333;
        }
        
        .dark .status-btn:hover {
          background: #3c3c3c;
          color: #d4d4d4;
        }
        
        .status-info {
          color: #666;
          padding: 2px 8px;
        }
        
        .dark .status-info {
          color: #888;
        }
      `}</style>
    </div>
  )
}

export default StatusBar
