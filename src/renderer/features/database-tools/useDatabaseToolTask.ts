import { useCallback, useEffect, useState } from 'react'
import { message } from 'antd'
import type {
  ConnectionData,
  DataSyncOptions,
  DataSyncPreview,
  DataSyncRequest,
  DataSyncResult,
  DataTransferPreview,
  DataTransferRequest,
  DataTransferResult,
  DataTransferStrategy,
  DatabaseToolEndpoint,
  DatabaseToolMode,
  StructureSyncPreview,
  StructureSyncRequest,
  StructureSyncResult,
} from '../../types'

export type ToolPreview =
  | DataTransferPreview
  | DataSyncPreview
  | StructureSyncPreview
export type ToolResult =
  | DataTransferResult
  | DataSyncResult
  | StructureSyncResult

interface UseDatabaseToolTaskOptions {
  open: boolean
  mode: DatabaseToolMode
  connections: ConnectionData[]
  connectedConnectionIds: ReadonlySet<string>
  initialSource?: DatabaseToolEndpoint
}

export function useDatabaseToolTask({
  open,
  mode,
  connections,
  connectedConnectionIds,
  initialSource,
}: UseDatabaseToolTaskOptions) {
  const [step, setStep] = useState(0)
  const [source, setSourceState] = useState<DatabaseToolEndpoint>({
    connId: '', database: '',
  })
  const [target, setTargetState] = useState<DatabaseToolEndpoint>({
    connId: '', database: '',
  })
  const [sourceTables, setSourceTables] = useState<string[]>([])
  const [targetTables, setTargetTables] = useState<string[]>([])
  const [selectedTables, setSelectedTables] = useState<string[]>([])
  const [transferStrategy, setTransferStrategy] =
    useState<DataTransferStrategy>('append')
  const [createMissing, setCreateMissing] = useState(true)
  const [syncOptions, setSyncOptions] = useState<DataSyncOptions>({
    insert: true,
    update: true,
    delete: false,
  })
  const [preview, setPreview] = useState<ToolPreview>()
  const [result, setResult] = useState<ToolResult>()
  const [loadingTables, setLoadingTables] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    if (!open) return
    const requestedSource = connections.find(
      connection => connection.id === initialSource?.connId,
    )
    const sourceConnection = (
      requestedSource && connectedConnectionIds.has(requestedSource.id)
        ? requestedSource
        : connections.find(connection => connectedConnectionIds.has(connection.id))
    )
    const targetConnection = connections.find(
      connection => (
        connection.id !== sourceConnection?.id
        && connectedConnectionIds.has(connection.id)
      ),
    ) || sourceConnection
    setSourceState({
      connId: sourceConnection?.id || '',
      database: initialSource?.database || sourceConnection?.database || '',
    })
    setTargetState({
      connId: targetConnection?.id || '',
      database: targetConnection?.database || '',
    })
    setStep(0)
    setSourceTables([])
    setTargetTables([])
    setSelectedTables([])
    setTransferStrategy('append')
    setCreateMissing(true)
    setSyncOptions({ insert: true, update: true, delete: false })
    setPreview(undefined)
    setResult(undefined)
    void window.logger.write(
      'info',
      'DatabaseTool',
      `打开数据库工具向导: 模式=${mode}, 已建连接=${connections.length}, 已连接=${connectedConnectionIds.size}`,
    )
  }, [open, mode])

  const clearPreparedState = useCallback(() => {
    setSourceTables([])
    setTargetTables([])
    setSelectedTables([])
    setPreview(undefined)
    setResult(undefined)
  }, [])

  const setSource = useCallback((endpoint: DatabaseToolEndpoint) => {
    setSourceState(endpoint)
    clearPreparedState()
  }, [clearPreparedState])

  const setTarget = useCallback((endpoint: DatabaseToolEndpoint) => {
    setTargetState(endpoint)
    clearPreparedState()
  }, [clearPreparedState])

  const swapEndpoints = useCallback(() => {
    setSourceState(target)
    setTargetState(source)
    clearPreparedState()
  }, [clearPreparedState, source, target])

  const validateEndpoints = () => {
    if (!source.connId || !source.database) throw new Error('请选择源数据库')
    if (!target.connId || !target.database) throw new Error('请选择目标数据库')
    if (
      source.connId === target.connId
      && source.database === target.database
    ) {
      throw new Error('源数据库和目标数据库不能相同')
    }
  }

  const loadTables = async () => {
    try {
      validateEndpoints()
      setLoadingTables(true)
      const sourceResponse = await window.database.getTables(
        source.connId, source.database,
      )
      if (!sourceResponse.success || !sourceResponse.data) {
        throw new Error(sourceResponse.error?.message || '读取源表失败')
      }
      // 单连接数据库驱动不一定支持并发请求，目标表在源表完成后读取。
      const targetResponse = await window.database.getTables(
        target.connId, target.database,
      )
      if (!targetResponse.success || !targetResponse.data) {
        throw new Error(targetResponse.error?.message || '读取目标表失败')
      }
      setSourceTables(sourceResponse.data)
      setTargetTables(targetResponse.data)
      setSelectedTables(sourceResponse.data)
      setStep(1)
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error))
    } finally {
      setLoadingTables(false)
    }
  }

  const buildRequest = ():
    DataTransferRequest | DataSyncRequest | StructureSyncRequest => {
    const scope = { source, target, tables: selectedTables }
    if (mode === 'transfer') {
      return { ...scope, strategy: transferStrategy, createMissing, batchSize: 200 }
    }
    if (mode === 'dataSync') {
      return { ...scope, options: syncOptions, batchSize: 200 }
    }
    return scope
  }

  const runPreview = async () => {
    if (selectedTables.length === 0) {
      message.warning('请至少选择一张数据表')
      return
    }
    if (
      mode === 'dataSync'
      && !syncOptions.insert
      && !syncOptions.update
      && !syncOptions.delete
    ) {
      message.warning('请至少选择一种同步操作')
      return
    }
    setPreviewing(true)
    try {
      const request = buildRequest()
      const response = mode === 'transfer'
        ? await window.databaseTool.previewTransfer(request as DataTransferRequest)
        : mode === 'dataSync'
          ? await window.databaseTool.previewDataSync(request as DataSyncRequest)
          : await window.databaseTool.previewStructureSync(request)
      if (!response.success || !response.data) {
        throw new Error(response.error?.detail || response.error?.message || '预检查失败')
      }
      setPreview(response.data)
      setStep(2)
    } catch (error) {
      message.error(`预检查失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setPreviewing(false)
    }
  }

  const execute = async () => {
    setExecuting(true)
    try {
      const request = buildRequest()
      const response = mode === 'transfer'
        ? await window.databaseTool.executeTransfer(request as DataTransferRequest)
        : mode === 'dataSync'
          ? await window.databaseTool.executeDataSync(request as DataSyncRequest)
          : await window.databaseTool.executeStructureSync(request)
      if (!response.success || !response.data) {
        throw new Error(response.error?.detail || response.error?.message || '任务执行失败')
      }
      setResult(response.data)
      setStep(3)
      message.success('数据库工具任务执行完成')
    } catch (error) {
      message.error(`执行失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setExecuting(false)
    }
  }

  return {
    step, setStep, source, target, sourceTables, targetTables, selectedTables,
    transferStrategy, createMissing, syncOptions, preview, result,
    loadingTables, previewing, executing,
    setSource, setTarget, swapEndpoints, setSelectedTables,
    setTransferStrategy, setCreateMissing, setSyncOptions,
    loadTables, runPreview, execute,
  }
}
