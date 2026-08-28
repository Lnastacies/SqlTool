import type { TableTextEncoding } from './tableTransferTypes'

function stripBom(buffer: Buffer, bytes: number): Buffer {
  return buffer.subarray(bytes)
}

export function detectTextEncoding(buffer: Buffer): TableTextEncoding {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return 'utf16le'
  }
  if (
    buffer.length >= 3
    && buffer[0] === 0xef
    && buffer[1] === 0xbb
    && buffer[2] === 0xbf
  ) return 'utf8bom'
  return 'utf8'
}

export function decodeTextBuffer(
  buffer: Buffer,
  encoding: TableTextEncoding = detectTextEncoding(buffer),
): string {
  if (encoding === 'utf16le') {
    const content = buffer[0] === 0xff && buffer[1] === 0xfe
      ? stripBom(buffer, 2)
      : buffer
    return content.toString('utf16le')
  }
  if (encoding === 'latin1') return buffer.toString('latin1')
  const content = (
    buffer[0] === 0xef
    && buffer[1] === 0xbb
    && buffer[2] === 0xbf
  ) ? stripBom(buffer, 3) : buffer
  return content.toString('utf8')
}

export function encodeTextChunk(
  content: string,
  encoding: TableTextEncoding,
  firstChunk: boolean,
): Buffer {
  if (encoding === 'utf16le') {
    const body = Buffer.from(content, 'utf16le')
    return firstChunk
      ? Buffer.concat([Buffer.from([0xff, 0xfe]), body])
      : body
  }
  if (encoding === 'latin1') return Buffer.from(content, 'latin1')
  const body = Buffer.from(content, 'utf8')
  return encoding === 'utf8bom' && firstChunk
    ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body])
    : body
}
