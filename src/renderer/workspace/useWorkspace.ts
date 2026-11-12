import { useCallback, useMemo, useReducer } from 'react'
import type {
  DataWorkspaceDocument,
  QueryWorkspaceDocument,
  WorkspaceDocument,
  WorkspaceSurface,
} from './workspaceTypes'
import {
  OBJECTS_TAB_ID,
  resolveActiveTabAfterClose,
} from './workspaceTabModel'

interface WorkspaceState {
  documents: WorkspaceDocument[]
  activeDocumentId: string
  surface: WorkspaceSurface
}

type WorkspaceAction =
  | { type: 'open'; document: WorkspaceDocument }
  | { type: 'activate'; id: string }
  | { type: 'update'; id: string; patch: Record<string, unknown> }
  | { type: 'close'; id: string }
  | { type: 'closeAll' }
  | { type: 'showObjects' }

const initialState: WorkspaceState = {
  documents: [],
  activeDocumentId: '',
  surface: 'objects',
}

function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case 'open': {
      const existing = state.documents.find(
        document => document.id === action.document.id,
      )
      const documents = existing
        ? state.documents.map(document =>
          document.id === action.document.id ? action.document : document,
        )
        : [...state.documents, action.document]
      return {
        documents,
        activeDocumentId: action.document.id,
        surface: 'documents',
      }
    }
    case 'activate':
      return {
        ...state,
        activeDocumentId: action.id,
        surface: 'documents',
      }
    case 'update':
      return {
        ...state,
        documents: state.documents.map(document =>
          document.id === action.id
            ? { ...document, ...action.patch } as WorkspaceDocument
            : document,
        ),
      }
    case 'close': {
      // 标签顺序中常驻表清单标签始终位于首位，参与相邻标签回落计算
      const tabIds = [
        OBJECTS_TAB_ID,
        ...state.documents.map(document => document.id),
      ]
      const activeTabId = state.surface === 'objects'
        ? OBJECTS_TAB_ID
        : state.activeDocumentId
      const nextTabId = resolveActiveTabAfterClose(
        tabIds,
        action.id,
        activeTabId,
      )
      const documents = state.documents.filter(
        document => document.id !== action.id,
      )
      const backToObjects = nextTabId === OBJECTS_TAB_ID
      return {
        documents,
        activeDocumentId: backToObjects ? '' : nextTabId,
        surface: backToObjects ? 'objects' : 'documents',
      }
    }
    case 'closeAll':
      return initialState
    case 'showObjects':
      // 切回常驻表清单标签时清空活动文档，避免命令误作用到隐藏文档
      return { ...state, surface: 'objects', activeDocumentId: '' }
    default:
      return state
  }
}

export function useWorkspace() {
  const [state, dispatch] = useReducer(workspaceReducer, initialState)

  const openQuery = useCallback((document: QueryWorkspaceDocument) => {
    dispatch({ type: 'open', document })
  }, [])

  const openData = useCallback((document: DataWorkspaceDocument) => {
    dispatch({ type: 'open', document })
  }, [])

  const activateDocument = useCallback((id: string) => {
    // 常驻表清单标签不是文档，切换时只恢复对象浏览视图
    dispatch(id === OBJECTS_TAB_ID ? { type: 'showObjects' } : { type: 'activate', id })
  }, [])

  const updateQuery = useCallback((
    id: string,
    patch: Partial<QueryWorkspaceDocument>,
  ) => {
    dispatch({ type: 'update', id, patch: patch as Record<string, unknown> })
  }, [])

  const updateData = useCallback((
    id: string,
    patch: Partial<DataWorkspaceDocument>,
  ) => {
    dispatch({ type: 'update', id, patch: patch as Record<string, unknown> })
  }, [])

  const closeDocument = useCallback((id: string) => {
    dispatch({ type: 'close', id })
  }, [])

  const closeAllDocuments = useCallback(() => {
    dispatch({ type: 'closeAll' })
  }, [])

  const showObjects = useCallback(() => {
    dispatch({ type: 'showObjects' })
  }, [])

  const queryDocuments = useMemo(
    () => state.documents.filter(
      (document): document is QueryWorkspaceDocument =>
        document.kind === 'query',
    ),
    [state.documents],
  )

  const dataDocuments = useMemo(
    () => state.documents.filter(
      (document): document is DataWorkspaceDocument =>
        document.kind === 'data',
    ),
    [state.documents],
  )

  const activeDocument = state.documents.find(
    document => document.id === state.activeDocumentId,
  )

  return {
    ...state,
    activeDocument,
    queryDocuments,
    dataDocuments,
    openQuery,
    openData,
    activateDocument,
    updateQuery,
    updateData,
    closeDocument,
    closeAllDocuments,
    showObjects,
  }
}
