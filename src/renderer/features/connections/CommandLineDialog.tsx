import React, { useEffect, useRef, useState } from 'react'
import { Button, Input, Modal, Select } from 'antd'
import ClearOutlined from '@ant-design/icons/ClearOutlined'
import PlayCircleOutlined from '@ant-design/icons/PlayCircleOutlined'
import type { ConnectionData } from '../../types'
import { formatTerminalResult } from './terminalResultFormatter'

interface CommandLineDialogProps {
  connection: ConnectionData
  initialDatabase?: string
  onClose: () => void
}

const MAX_OUTPUT_LINES = 2000
const { TextArea } = Input

export default function CommandLineDialog({
  connection,
  initialDatabase,
  onClose,
}: CommandLineDialogProps) {
  const [databases, setDatabases] = useState<string[]>([])
  const [database, setDatabase] = useState(
    initialDatabase ?? connection.database ?? '',
  )
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<string[]>([
    `SQLTool 命令列界面 - ${connection.name} (${connection.type})`,
    '输入 SQL 后按 Ctrl+Enter 执行，输入 help 查看本地命令。',
  ])
  const inputRef = useRef<any>(null)
  const outputRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    let cancelled = false
    void window.database.getDatabases(connection.id).then(result => {
      if (cancelled) return
      if (result.success && result.data) {
        setDatabases(result.data)
        return
      }
      appendOutput([
        `[警告] 数据库列表加载失败: ${result.error?.message || '未知错误'}`,
      ])
    })
    return () => {
      cancelled = true
    }
  }, [connection.id])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  const appendOutput = (lines: string[]) => {
    setOutput(previous => [...previous, ...lines].slice(-MAX_OUTPUT_LINES))
  }

  const runCommand = async () => {
    const sql = command.trim()
    if (!sql || running) return

    setCommand('')
    setHistory(previous => [...previous.filter(item => item !== sql), sql])
    setHistoryIndex(-1)
    appendOutput(['', `${buildPrompt(connection.name, database)}> ${sql}`])

    const localCommand = sql.toLocaleLowerCase()
    if (localCommand === 'clear' || localCommand === 'cls') {
      setOutput([])
      return
    }
    if (localCommand === 'help') {
      appendOutput([
        '本地命令: help（帮助）、clear/cls（清屏）、exit（关闭）',
        'SQL 快捷键: Ctrl+Enter 执行，Alt+↑/Alt+↓ 浏览历史。',
      ])
      return
    }
    if (localCommand === 'exit') {
      onClose()
      return
    }

    setRunning(true)
    const startedAt = performance.now()
    const sqlPreview = sql.replace(/\s+/g, ' ').slice(0, 160)
    void window.logger.write(
      'info',
      'CommandLine',
      `开始执行命令: 连接=${connection.id}, 数据库=${database || '服务器级'}, SQL=${sqlPreview}`,
    )
    try {
      const response = await window.database.executeSQL(
        connection.id,
        database,
        sql,
      )
      if (!response.success || !response.data) {
        throw new Error(response.error?.detail || response.error?.message || '执行失败')
      }
      if (!response.data.success) {
        throw new Error(response.data.message || '执行失败')
      }
      appendOutput(formatTerminalResult(response.data))
      void window.logger.write(
        'info',
        'CommandLine',
        `命令执行完成: 连接=${connection.id}, 数据库=${database || '服务器级'}, 耗时=${Math.round(performance.now() - startedAt)}ms`,
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      appendOutput([`[错误] ${detail}`])
      void window.logger.write(
        'error',
        'CommandLine',
        `命令执行失败: 连接=${connection.id}, 数据库=${database || '服务器级'}, 原因=${detail}`,
      )
    } finally {
      setRunning(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  const browseHistory = (direction: -1 | 1) => {
    if (history.length === 0) return
    const nextIndex = historyIndex < 0
      ? history.length - 1
      : Math.max(0, Math.min(history.length - 1, historyIndex + direction))
    setHistoryIndex(nextIndex)
    setCommand(history[nextIndex])
  }

  return (
    <Modal
      className="command-line-dialog"
      title={`命令列界面 - ${connection.name}`}
      open
      width={880}
      maskClosable={false}
      destroyOnHidden
      onCancel={onClose}
      afterOpenChange={open => {
        if (open) inputRef.current?.focus()
      }}
      footer={[
        <Button key="clear" icon={<ClearOutlined />} onClick={() => setOutput([])}>
          清屏
        </Button>,
        <Button key="close" onClick={onClose}>关闭</Button>,
        <Button
          key="execute"
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={running}
          disabled={!command.trim()}
          onClick={() => void runCommand()}
        >
          执行
        </Button>,
      ]}
    >
      <div className="command-line-toolbar">
        <span>数据库</span>
        <Select
          value={database || undefined}
          placeholder="服务器级"
          allowClear={connection.type !== 'SQLite'}
          disabled={connection.type === 'SQLite'}
          options={databases.map(name => ({ value: name, label: name }))}
          onChange={value => setDatabase(value || '')}
        />
        <span className="command-line-toolbar__hint">Ctrl+Enter 执行</span>
      </div>
      <pre ref={outputRef} className="command-line-output">
        {output.join('\n')}
      </pre>
      <TextArea
        ref={inputRef}
        className="command-line-input"
        value={command}
        autoSize={{ minRows: 3, maxRows: 8 }}
        placeholder="输入 SQL 命令..."
        onChange={event => setCommand(event.target.value)}
        onKeyDown={event => {
          if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault()
            void runCommand()
          } else if (event.altKey && event.key === 'ArrowUp') {
            event.preventDefault()
            browseHistory(-1)
          } else if (event.altKey && event.key === 'ArrowDown') {
            event.preventDefault()
            browseHistory(1)
          }
        }}
      />
    </Modal>
  )
}

function buildPrompt(connectionName: string, database: string): string {
  return `${connectionName}${database ? `/${database}` : ''}`
}
