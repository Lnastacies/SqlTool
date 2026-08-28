export interface ConnectionColorOption {
  key: string
  label: string
  value?: string
}

export const CONNECTION_COLOR_OPTIONS: ConnectionColorOption[] = [
  { key: 'default', label: '默认', value: undefined },
  { key: 'red', label: '红色', value: '#D94A4A' },
  { key: 'orange', label: '橙色', value: '#D9822B' },
  { key: 'yellow', label: '黄色', value: '#C99A1A' },
  { key: 'green', label: '绿色', value: '#3F9D63' },
  { key: 'blue', label: '蓝色', value: '#3578C4' },
  { key: 'purple', label: '紫色', value: '#7A5AC8' },
  { key: 'gray', label: '灰色', value: '#727B86' },
]
