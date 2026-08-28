import { useEffect, useMemo } from 'react'
import { createCommandDefinitions } from './commandCatalog'
import type {
  AppCommandId,
  CommandActions,
  CommandController,
  CommandState,
} from './commandTypes'

const globalShortcuts: Partial<Record<string, AppCommandId>> = {
  'ctrl+n': 'connection.new',
  'ctrl+t': 'query.new',
  'ctrl+o': 'file.openSql',
  'ctrl+s': 'file.save',
  'ctrl+shift+s': 'file.saveAs',
  'ctrl+enter': 'query.execute',
  'ctrl+shift+enter': 'query.executeAll',
  'ctrl+.': 'query.stop',
  f5: 'view.refresh',
  'ctrl+w': 'window.close',
}

function shortcutFromEvent(event: KeyboardEvent): string {
  const parts: string[] = []
  if (event.ctrlKey) parts.push('ctrl')
  if (event.shiftKey) parts.push('shift')
  if (event.altKey) parts.push('alt')
  if (event.metaKey) parts.push('meta')
  parts.push(event.key.toLowerCase())
  return parts.join('+')
}

async function writeCommandLog(
  level: 'info' | 'warn' | 'error',
  message: string,
): Promise<void> {
  try {
    await (window as any).logger?.write(level, 'Command', message)
  } catch (error) {
    console.warn('命令日志写入失败:', error)
  }
}

export function useAppCommands(
  actions: CommandActions,
  state: CommandState,
): CommandController {
  const controller = useMemo<CommandController>(() => {
    const definitions = createCommandDefinitions(actions, state)
    const commandMap = new Map(
      definitions.map(definition => [definition.id, definition]),
    )

    const get = (id: AppCommandId) => {
      const command = commandMap.get(id)
      if (!command) {
        throw new Error(`未注册命令: ${id}`)
      }
      return command
    }

    return {
      get,
      execute: async (id: AppCommandId) => {
        const command = get(id)
        if (!command.enabled) {
          const reason = command.disabledReason || '当前上下文不可用'
          await writeCommandLog('warn', `命令不可用: ${id}, 原因: ${reason}`)
          return
        }

        await writeCommandLog('info', `开始执行命令: ${id} (${command.label})`)
        try {
          await command.execute()
          await writeCommandLog('info', `命令执行完成: ${id}`)
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error)
          await writeCommandLog('error', `命令执行失败: ${id}, 原因: ${detail}`)
          throw error
        }
      },
    }
  }, [actions, state])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const commandId = globalShortcuts[shortcutFromEvent(event)]
      if (!commandId) return

      event.preventDefault()
      void controller.execute(commandId)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [controller])

  return controller
}
