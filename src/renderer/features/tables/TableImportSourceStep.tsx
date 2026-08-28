import React from 'react'
import {
  Alert,
  Checkbox,
  Col,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import FileExcelOutlined from '@ant-design/icons/FileExcelOutlined'
import FileTextOutlined from '@ant-design/icons/FileTextOutlined'
import type {
  TableImportOptions,
  TableImportPreview,
  TableTextFormatOptions,
} from '../../types'
import TableDataPreviewTable from './TableDataPreviewTable'

const { Text } = Typography

interface TableImportSourceStepProps {
  preview: TableImportPreview
  options: TableImportOptions
  onChange: (options: TableImportOptions) => void
}

const FORMAT_LABELS: Record<TableImportOptions['format'], string> = {
  txt: '文本文件',
  csv: 'CSV',
  json: 'JSON',
  xml: 'XML',
  xlsx: 'Excel',
}

const FORMAT_DESCRIPTIONS: Record<TableImportOptions['format'], string> = {
  txt: '按指定分隔符和文本识别符解析每一行。',
  csv: '按 CSV 规则处理分隔符、引号和跨行字段。',
  json: '文件根节点必须是对象数组，各对象键名作为源字段。',
  xml: '支持 SQLTool 导出结构及 rows/row 通用节点结构。',
  xlsx: '读取第一个工作表，第一行作为源字段标题。',
}

function updateTextOptions(
  options: TableImportOptions,
  patch: Partial<TableTextFormatOptions>,
): TableImportOptions {
  if (!options.text) return options
  return { ...options, text: { ...options.text, ...patch } }
}

export default function TableImportSourceStep({
  preview,
  options,
  onChange,
}: TableImportSourceStepProps) {
  const isText = options.format === 'txt' || options.format === 'csv'

  return (
    <div className="table-import-source">
      {/* 源文件信息条 */}
      <div className="table-import-source__info">
        <Space size={6}>
          {options.format === 'xlsx'
            ? <FileExcelOutlined />
            : <FileTextOutlined />}
          <Text className="table-import-source__filename" title={preview.filePath}>
            {preview.fileName}
          </Text>
        </Space>
        <Space size={12}>
          <span className="table-import-source__meta">
            <Tag color="blue">{FORMAT_LABELS[options.format]}</Tag>
          </span>
          <span className="table-import-source__meta">
            {preview.totalRows} 行 · {preview.columns.length} 个字段
          </span>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message={FORMAT_DESCRIPTIONS[options.format]}
        style={{ marginBottom: 8 }}
      />

      {/* 文本格式选项：使用 Row/Col 网格布局，替代裸 label 堆叠 */}
      {isText && options.text && (
        <Row gutter={[12, 8]} className="table-import-source__options">
          <Col span={6}>
            <label className="table-import-source__field">
              <span>文件编码</span>
              <Select
                size="small"
                value={options.text.encoding}
                options={[
                  { value: 'utf8bom', label: 'UTF-8（带 BOM）' },
                  { value: 'utf8', label: 'UTF-8' },
                  { value: 'utf16le', label: 'UTF-16 LE' },
                  { value: 'latin1', label: 'Latin-1' },
                ]}
                onChange={encoding => onChange(updateTextOptions(
                  options,
                  { encoding },
                ))}
              />
            </label>
          </Col>
          <Col span={6}>
            <label className="table-import-source__field">
              <span>字段分隔符</span>
              <Select
                size="small"
                value={options.text.delimiter}
                options={[
                  { value: ',', label: '逗号 (,)' },
                  { value: '\t', label: '制表符 (Tab)' },
                  { value: ';', label: '分号 (;)' },
                  { value: '|', label: '竖线 (|)' },
                ]}
                onChange={delimiter => onChange(updateTextOptions(
                  options,
                  { delimiter },
                ))}
              />
            </label>
          </Col>
          <Col span={6}>
            <label className="table-import-source__field">
              <span>文本识别符</span>
              <Input
                size="small"
                maxLength={1}
                value={options.text.quote}
                placeholder="留空不用"
                onChange={event => onChange(updateTextOptions(
                  options,
                  { quote: event.target.value },
                ))}
              />
            </label>
          </Col>
          <Col span={6}>
            <label className="table-import-source__field">
              <span>记录分隔符</span>
              <Radio.Group
                size="small"
                value={options.text.recordDelimiter}
                options={[
                  { value: '\r\n', label: 'CRLF' },
                  { value: '\n', label: 'LF' },
                ]}
                onChange={event => onChange(updateTextOptions(
                  options,
                  { recordDelimiter: event.target.value },
                ))}
              />
            </label>
          </Col>
          <Col span={24}>
            <Checkbox
              checked={options.text.includeHeader}
              onChange={event => onChange(updateTextOptions(
                options,
                { includeHeader: event.target.checked },
              ))}
            >
              第一行包含字段名
            </Checkbox>
          </Col>
        </Row>
      )}

      {/* 数据预览：让用户调整格式后立即看到解析效果 */}
      <div className="table-import-source__preview">
        <Text type="secondary" className="table-import-source__preview-title">
          数据预览（前 5 行）
        </Text>
        <TableDataPreviewTable preview={preview} maxRows={5} height={180} />
      </div>
    </div>
  )
}
