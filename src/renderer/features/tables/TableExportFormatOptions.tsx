import React from 'react'
import { Checkbox, Input, Radio, Select } from 'antd'
import type { TableExportOptions } from '../../types'

interface TableExportFormatOptionsProps {
  value: Omit<TableExportOptions, 'columns'>
  onChange: (value: Omit<TableExportOptions, 'columns'>) => void
}

export default function TableExportFormatOptions({
  value,
  onChange,
}: TableExportFormatOptionsProps) {
  const update = (patch: Partial<Omit<TableExportOptions, 'columns'>>) => {
    onChange({ ...value, ...patch })
  }
  const updateText = (
    patch: Partial<NonNullable<TableExportOptions['text']>>,
  ) => {
    if (value.text) update({ text: { ...value.text, ...patch } })
  }
  const textFormat = value.format === 'csv' || value.format === 'txt'

  return (
    <div className="table-export-options">
      {textFormat && value.text && (
        <>
          <label>
            <span>文件编码</span>
            <Select
              value={value.text.encoding}
              options={[
                { value: 'utf8bom', label: 'UTF-8（带 BOM）' },
                { value: 'utf8', label: 'UTF-8' },
                { value: 'utf16le', label: 'UTF-16 LE' },
                { value: 'latin1', label: 'Latin-1' },
              ]}
              onChange={encoding => updateText({ encoding })}
            />
          </label>
          <label>
            <span>字段分隔符</span>
            <Select
              value={value.text.delimiter}
              options={[
                { value: ',', label: '逗号 (,)' },
                { value: '\t', label: '制表符 (Tab)' },
                { value: ';', label: '分号 (;)' },
                { value: '|', label: '竖线 (|)' },
              ]}
              onChange={delimiter => updateText({ delimiter })}
            />
          </label>
          <label>
            <span>文本识别符</span>
            <Input
              maxLength={1}
              value={value.text.quote}
              placeholder="留空表示不使用"
              onChange={event => updateText({ quote: event.target.value })}
            />
          </label>
          <label>
            <span>记录分隔符</span>
            <Radio.Group
              size="small"
              value={value.text.recordDelimiter}
              options={[
                { value: '\r\n', label: 'Windows (CRLF)' },
                { value: '\n', label: 'Unix (LF)' },
              ]}
              onChange={event => updateText({
                recordDelimiter: event.target.value,
              })}
            />
          </label>
          <Checkbox
            checked={value.text.includeHeader}
            onChange={event => updateText({
              includeHeader: event.target.checked,
            })}
          >
            输出字段标题
          </Checkbox>
        </>
      )}

      {value.format === 'sql' && (
        <Checkbox
          checked={value.sql?.includeTransaction}
          onChange={event => update({
            sql: { includeTransaction: event.target.checked },
          })}
        >
          使用事务包裹 INSERT 语句
        </Checkbox>
      )}

      {value.format === 'xml' && (
        <Checkbox
          checked={value.xml?.prettyPrint}
          onChange={event => update({
            xml: { prettyPrint: event.target.checked },
          })}
        >
          格式化 XML 节点
        </Checkbox>
      )}

      {value.format === 'xlsx' && (
        <>
          <Checkbox
            checked={value.excel?.freezeHeader}
            onChange={event => update({
              excel: {
                freezeHeader: event.target.checked,
                autoFilter: value.excel?.autoFilter !== false,
              },
            })}
          >
            冻结标题行
          </Checkbox>
          <Checkbox
            checked={value.excel?.autoFilter}
            onChange={event => update({
              excel: {
                freezeHeader: value.excel?.freezeHeader !== false,
                autoFilter: event.target.checked,
              },
            })}
          >
            为标题行启用筛选
          </Checkbox>
        </>
      )}

      {value.format !== 'sql' && (
        <label>
          <span>二进制字段</span>
          <Radio.Group
            size="small"
            value={value.binaryEncoding}
            options={[
              { value: 'base64', label: 'Base64' },
              { value: 'hex', label: '十六进制' },
            ]}
            onChange={event => update({
              binaryEncoding: event.target.value,
            })}
          />
        </label>
      )}
    </div>
  )
}
