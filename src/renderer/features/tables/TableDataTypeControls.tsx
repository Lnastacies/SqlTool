import React, { useMemo, useState } from 'react'
import {
  AutoComplete,
  Checkbox,
  Input,
  Tooltip,
} from 'antd'
import type { DatabaseType } from '../../types'
import { TABLE_DATA_TYPE_OPTIONS } from './tableDataTypeCatalog'
import {
  parseTableDataType,
  selectTableDataType,
  updateTableDataType,
} from './tableDataTypeModel'

interface TableDataTypeControlProps {
  databaseType: DatabaseType
  value: string
  onChange: (value: string) => void
}

export function TableDataTypeSelect({
  databaseType,
  value,
  onChange,
}: TableDataTypeControlProps) {
  const parsed = parseTableDataType(databaseType, value)
  const [isSearching, setIsSearching] = useState(false)
  const options = useMemo(() => {
    const groups = new Map<string, string[]>()
    TABLE_DATA_TYPE_OPTIONS[databaseType].forEach(option => {
      const values = groups.get(option.category) || []
      values.push(option.name)
      groups.set(option.category, values)
    })
    return Array.from(groups, ([label, values]) => ({
      label,
      options: values.map(typeName => ({
        label: typeName,
        value: typeName,
      })),
    }))
  }, [databaseType])

  return (
    <Tooltip title={`最终 SQL 类型：${value}`} mouseEnterDelay={0.5}>
      <AutoComplete
        size="small"
        value={parsed.name}
        options={options}
        placeholder="选择或输入类型"
        onChange={typeName => onChange(
          selectTableDataType(databaseType, typeName),
        )}
        onFocus={event => {
          setIsSearching(false)
          // 延迟选中原类型，避免鼠标按下后光标位置覆盖选择范围。
          requestAnimationFrame(() => (
            event.target as HTMLInputElement
          ).select())
        }}
        onSearch={() => setIsSearching(true)}
        onSelect={() => setIsSearching(false)}
        onBlur={() => setIsSearching(false)}
        filterOption={(input, option) => (
          !isSearching
          || String(option?.label || '')
            .toLocaleLowerCase()
            .includes(input.trim().toLocaleLowerCase())
        )}
      />
    </Tooltip>
  )
}

export function TableDataTypeArgumentInput({
  databaseType,
  value,
  onChange,
}: TableDataTypeControlProps) {
  const parsed = parseTableDataType(databaseType, value)
  const parameter = parsed.option?.parameter
  const disabled = Boolean(parsed.option && parameter === 'none')
  const placeholder = parameter === 'values'
    ? "'A','B'"
    : parsed.option?.allowMax
      ? '数字/MAX'
      : parameter === 'precision' || parameter === 'precisionScale'
        ? '精度'
        : parameter === 'length'
          ? '长度'
          : parsed.option
            ? '不适用'
            : '可选参数'

  return (
    <Input
      size="small"
      value={parsed.argument}
      disabled={disabled}
      placeholder={placeholder}
      onChange={event => onChange(updateTableDataType(
        databaseType,
        value,
        { argument: event.target.value.trim() },
      ))}
    />
  )
}

export function TableDataTypeScaleInput({
  databaseType,
  value,
  onChange,
}: TableDataTypeControlProps) {
  const parsed = parseTableDataType(databaseType, value)
  const enabled = parsed.option?.parameter === 'precisionScale'

  return (
    <Input
      size="small"
      value={parsed.scale}
      disabled={!enabled}
      placeholder={enabled ? '小数位' : '不适用'}
      onChange={event => onChange(updateTableDataType(
        databaseType,
        value,
        { scale: event.target.value.trim() },
      ))}
    />
  )
}

export function TableDataTypeUnsignedToggle({
  databaseType,
  value,
  onChange,
}: TableDataTypeControlProps) {
  const parsed = parseTableDataType(databaseType, value)
  const enabled = (
    databaseType === 'MySQL'
    && Boolean(parsed.option?.supportsUnsigned || parsed.unsigned)
  )

  return (
    <Tooltip title={enabled ? '使用 MySQL UNSIGNED 属性' : '当前类型不支持无符号'}>
      <span>
        <Checkbox
          checked={parsed.unsigned}
          disabled={!enabled}
          onChange={event => onChange(updateTableDataType(
            databaseType,
            value,
            {
              unsigned: event.target.checked,
              zerofill: event.target.checked ? parsed.zerofill : false,
            },
          ))}
        />
      </span>
    </Tooltip>
  )
}
