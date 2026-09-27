import http from 'node:http'

import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as syncProtocol from 'y-protocols/sync'
import WebSocket, { WebSocketServer } from 'ws'
import * as Y from 'yjs'

const host = process.env.HOST || '0.0.0.0'
const port = Number(process.env.PORT || 1234)

const messageSync = 0
const messageAwareness = 1
const pingTimeout = 30000

const docs = new Map()

function getDoc(name) {
  const existing = docs.get(name)
  if (existing) {
    return existing
  }

  const doc = new Y.Doc()
  const awareness = new awarenessProtocol.Awareness(doc)
  const conns = new Map()

  awareness.setLocalState(null)

  doc.on('update', (update) => {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeUpdate(encoder, update)
    const message = encoding.toUint8Array(encoder)

    conns.forEach((_, conn) => {
      send(conn, message)
    })
  })

  awareness.on('update', ({ added, updated, removed }, conn) => {
    const changedClients = added.concat(updated, removed)

    if (conn) {
      const controlledIds = conns.get(conn)
      if (controlledIds) {
        added.forEach((id) => controlledIds.add(id))
        removed.forEach((id) => controlledIds.delete(id))
      }
    }

    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients),
    )

    const message = encoding.toUint8Array(encoder)
    conns.forEach((_, ws) => {
      send(ws, message)
    })
  })

  const entry = { name, doc, awareness, conns }
  docs.set(name, entry)
  return entry
}

function removeDocIfEmpty(entry) {
  if (entry.conns.size === 0) {
    entry.doc.destroy()
    docs.delete(entry.name)
  }
}

function closeConn(entry, conn) {
  const controlledIds = entry.conns.get(conn)

  if (controlledIds) {
    entry.conns.delete(conn)
    awarenessProtocol.removeAwarenessStates(
      entry.awareness,
      Array.from(controlledIds),
      null,
    )
  }

  try {
    conn.close()
  } catch {
    // ignore close failures
  }

  removeDocIfEmpty(entry)
  console.log(`[disconnect] room=${entry.name} clients=${entry.conns.size}`)
}

function send(conn, message) {
  if (conn.readyState !== WebSocket.OPEN && conn.readyState !== WebSocket.CONNECTING) {
    try {
      conn.close()
    } catch {
      // ignore close failures
    }
    return
  }

  conn.send(message, (error) => {
    if (error) {
      try {
        conn.close()
      } catch {
        // ignore close failures
      }
    }
  })
}

function setupWSConnection(conn, req) {
  const docName = (req.url || '/').slice(1).split('?')[0] || 'default'
  const entry = getDoc(docName)

  entry.conns.set(conn, new Set())
  conn.binaryType = 'arraybuffer'

  conn.on('message', (message) => {
    try {
      const decoder = decoding.createDecoder(new Uint8Array(message))
      const encoder = encoding.createEncoder()
      const messageType = decoding.readVarUint(decoder)

      switch (messageType) {
        case messageSync:
          encoding.writeVarUint(encoder, messageSync)
          syncProtocol.readSyncMessage(decoder, encoder, entry.doc, conn)
          if (encoding.length(encoder) > 1) {
            send(conn, encoding.toUint8Array(encoder))
          }
          break
        case messageAwareness:
          awarenessProtocol.applyAwarenessUpdate(
            entry.awareness,
            decoding.readVarUint8Array(decoder),
            conn,
          )
          break
        default:
          break
      }
    } catch (error) {
      console.error('[message-error]', error)
    }
  })

  let pongReceived = true
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      clearInterval(pingInterval)
      closeConn(entry, conn)
      return
    }

    pongReceived = false
    try {
      conn.ping()
    } catch {
      clearInterval(pingInterval)
      closeConn(entry, conn)
    }
  }, pingTimeout)

  conn.on('pong', () => {
    pongReceived = true
  })

  conn.on('close', () => {
    clearInterval(pingInterval)
    closeConn(entry, conn)
  })

  conn.on('error', (error) => {
    console.error('[socket-error]', error)
  })

  const syncEncoder = encoding.createEncoder()
  encoding.writeVarUint(syncEncoder, messageSync)
  syncProtocol.writeSyncStep1(syncEncoder, entry.doc)
  send(conn, encoding.toUint8Array(syncEncoder))

  const awarenessStates = entry.awareness.getStates()
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder()
    encoding.writeVarUint(awarenessEncoder, messageAwareness)
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        entry.awareness,
        Array.from(awarenessStates.keys()),
      ),
    )
    send(conn, encoding.toUint8Array(awarenessEncoder))
  }

  console.log(`[connect] room=${docName} clients=${entry.conns.size}`)
}

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('ok')
})

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    setupWSConnection(ws, request)
  })
})

server.listen(port, host, () => {
  console.log(`yjs websocket server running at ws://${host}:${port}`)
})
