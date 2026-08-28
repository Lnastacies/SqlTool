import React from 'react'

interface CellValueDisplayProps {
  value: unknown
  useDefault?: boolean
}

export default function CellValueDisplay({
  value,
  useDefault = false,
}: CellValueDisplayProps) {
  if (useDefault) {
    return <span className="cell-default">DEFAULT</span>
  }
  if (value === null || value === undefined) {
    return <span className="cell-null">NULL</span>
  }
  if (value instanceof Uint8Array) {
    return <span className="cell-binary">[BINARY {value.length} bytes]</span>
  }
  if (typeof value === 'object') {
    try {
      return <>{JSON.stringify(value)}</>
    } catch {
      return <>{String(value)}</>
    }
  }
  return <>{String(value)}</>
}
