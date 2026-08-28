import React from 'react'
import { Radio, Typography } from 'antd'
import CodeOutlined from '@ant-design/icons/CodeOutlined'
import FileExcelOutlined from '@ant-design/icons/FileExcelOutlined'
import FileTextOutlined from '@ant-design/icons/FileTextOutlined'
import GlobalOutlined from '@ant-design/icons/GlobalOutlined'
import TableOutlined from '@ant-design/icons/TableOutlined'
import type {
  TableExportFormat,
  TableExportOptions,
} from '../../types'
import { createTableExportOptions } from './tableTransferDefaults'
import TableExportFormatOptions from './TableExportFormatOptions'

const { Text } = Typography

interface TableExportFormatStepProps {
  value: Omit<TableExportOptions, 'columns'>
  onChange: (value: Omit<TableExportOptions, 'columns'>) => void
}

const FORMATS: Array<{
  value: TableExportFormat
  title: string
  description: string
  icon: React.ReactNode
}> = [
  { value: 'csv', title: 'CSV', description: '分隔文本', icon: <TableOutlined /> },
  { value: 'txt', title: 'TXT', description: '制表符文本', icon: <FileTextOutlined /> },
  { value: 'xlsx', title: 'Excel', description: '工作簿', icon: <FileExcelOutlined /> },
  { value: 'json', title: 'JSON', description: '对象数组', icon: <CodeOutlined /> },
  { value: 'xml', title: 'XML', description: '节点结构', icon: <CodeOutlined /> },
  { value: 'sql', title: 'SQL', description: 'INSERT 语句', icon: <CodeOutlined /> },
  { value: 'html', title: 'HTML', description: '表格文档', icon: <GlobalOutlined /> },
]

/**
 * 导出第二步：选择文件格式与配置选项。
 * 格式选择使用紧凑卡片网格，选中后下方紧跟对应格式选项，
 * 让格式选择和参数配置在视觉上保持一体。
 */
export default function TableExportFormatStep({
  value,
  onChange,
}: TableExportFormatStepProps) {
  return (
    <div className="table-export-format-step">
      <Radio.Group
        value={value.format}
        className="table-export__formats"
        onChange={event => onChange(createTableExportOptions(
          event.target.value,
        ))}
      >
        {FORMATS.map(item => (
          <Radio.Button key={item.value} value={item.value}>
            <span className="table-export__format-icon">{item.icon}</span>
            <strong>{item.title}</strong>
            <small>{item.description}</small>
          </Radio.Button>
        ))}
      </Radio.Group>

      {/* 格式选项紧跟所选格式下方，视觉一体 */}
      <div className="table-export__format-config">
        <Text type="secondary" className="table-export__format-config-title">
          {value.format.toUpperCase()} 格式选项
        </Text>
        <TableExportFormatOptions value={value} onChange={onChange} />
      </div>
    </div>
  )
}
