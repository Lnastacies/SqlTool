import React from 'react'
import { Tooltip } from 'antd'
import ApiOutlined from '@ant-design/icons/ApiOutlined'
import AppstoreOutlined from '@ant-design/icons/AppstoreOutlined'
import BarChartOutlined from '@ant-design/icons/BarChartOutlined'
import BarsOutlined from '@ant-design/icons/BarsOutlined'
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined'
import CloudUploadOutlined from '@ant-design/icons/CloudUploadOutlined'
import CloudSyncOutlined from '@ant-design/icons/CloudSyncOutlined'
import CodeOutlined from '@ant-design/icons/CodeOutlined'
import EyeOutlined from '@ant-design/icons/EyeOutlined'
import FileTextOutlined from '@ant-design/icons/FileTextOutlined'
import FunctionOutlined from '@ant-design/icons/FunctionOutlined'
import HistoryOutlined from '@ant-design/icons/HistoryOutlined'
import MoonOutlined from '@ant-design/icons/MoonOutlined'
import PartitionOutlined from '@ant-design/icons/PartitionOutlined'
import PlusOutlined from '@ant-design/icons/PlusOutlined'
import RobotOutlined from '@ant-design/icons/RobotOutlined'
import StopOutlined from '@ant-design/icons/StopOutlined'
import SunOutlined from '@ant-design/icons/SunOutlined'
import SyncOutlined from '@ant-design/icons/SyncOutlined'
import TableOutlined from '@ant-design/icons/TableOutlined'
import TeamOutlined from '@ant-design/icons/TeamOutlined'
import { TOOLBAR_GROUPS } from '../commands/commandLayout'
import type {
  AppCommandId,
  CommandController,
  CommandDefinition,
} from '../commands/commandTypes'

interface ToolbarProps {
  commands: CommandController
}

interface ToolButtonProps {
  command: CommandDefinition
  icon: React.ReactNode
  tone: string
  onExecute: (id: AppCommandId) => void
}

const iconMap: Record<AppCommandId, React.ReactNode> = {
  'connection.new': <ApiOutlined />,
  'query.new': <PlusOutlined />,
  'query.execute': <CodeOutlined />,
  'query.executeAll': <CodeOutlined />,
  'query.stop': <StopOutlined />,
  'file.openSql': <FileTextOutlined />,
  'file.save': <FileTextOutlined />,
  'file.saveAs': <FileTextOutlined />,
  'application.exit': <FileTextOutlined />,
  'edit.undo': <HistoryOutlined />,
  'edit.redo': <HistoryOutlined />,
  'edit.find': <BarsOutlined />,
  'edit.replace': <BarsOutlined />,
  'view.objects': <AppstoreOutlined />,
  'view.details': <BarsOutlined />,
  'view.refresh': <HistoryOutlined />,
  'view.theme': <MoonOutlined />,
  'favorite.add': <PlusOutlined />,
  'favorite.manage': <BarsOutlined />,
  'object.table': <TableOutlined />,
  'object.view': <EyeOutlined />,
  'object.function': <FunctionOutlined />,
  'object.event': <ClockCircleOutlined />,
  'object.query': <CodeOutlined />,
  'object.user': <TeamOutlined />,
  'tool.transfer': <CloudSyncOutlined />,
  'tool.dataSync': <SyncOutlined />,
  'tool.structureSync': <PartitionOutlined />,
  'tool.report': <BarChartOutlined />,
  'tool.backup': <CloudUploadOutlined />,
  'tool.automation': <RobotOutlined />,
  'tool.model': <CloudSyncOutlined />,
  'window.close': <BarsOutlined />,
  'window.closeAll': <BarsOutlined />,
  'help.about': <FileTextOutlined />,
  'help.changelog': <HistoryOutlined />,
}

const toneMap: Partial<Record<AppCommandId, string>> = {
  'connection.new': 'blue',
  'query.new': 'blue',
  'query.execute': 'blue',
  'query.stop': 'red',
  'object.table': 'cyan',
  'object.view': 'slate',
  'object.function': 'violet',
  'object.event': 'green',
  'object.query': 'blue',
  'object.user': 'orange',
  'tool.report': 'rose',
  'tool.backup': 'teal',
  'tool.automation': 'green',
  'tool.model': 'blue',
  'tool.transfer': 'blue',
  'tool.dataSync': 'teal',
  'tool.structureSync': 'violet',
  'view.details': 'slate',
  'view.theme': 'amber',
}

function ToolButton({
  command,
  icon,
  tone,
  onExecute,
}: ToolButtonProps) {
  const title = command.enabled
    ? command.label
    : `${command.label}：${command.disabledReason}`

  return (
    <Tooltip title={title} mouseEnterDelay={0.5}>
      <button
        className={`tool-command${command.checked ? ' tool-command--active' : ''}`}
        type="button"
        onClick={() => onExecute(command.id)}
        disabled={!command.enabled}
      >
        <span className={`tool-command__icon tool-command__icon--${tone}`}>{icon}</span>
        <span className="tool-command__label">{command.label}</span>
      </button>
    </Tooltip>
  )
}

function Toolbar({ commands }: ToolbarProps) {
  return (
    <div className="sqltool-toolbar">
      {TOOLBAR_GROUPS.map((group, groupIndex) => (
        <div
          className={`tool-group${
            groupIndex === TOOLBAR_GROUPS.length - 1
              ? ' tool-group--utility'
              : ''
          }`}
          key={`toolbar-group-${groupIndex}`}
        >
          {group.map(commandId => {
            const command = commands.get(commandId)
            const icon = commandId === 'view.details'
              ? (command.checked ? <AppstoreOutlined /> : <BarsOutlined />)
              : commandId === 'view.theme'
                ? (command.checked ? <SunOutlined /> : <MoonOutlined />)
                : iconMap[commandId]
            return (
              <ToolButton
                command={command}
                icon={icon}
                key={commandId}
                tone={toneMap[commandId] || 'slate'}
                onExecute={(id) => {
                  void commands.execute(id)
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default Toolbar
