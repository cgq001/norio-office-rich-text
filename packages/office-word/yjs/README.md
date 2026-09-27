# Yjs Server Example

This folder is shipped with the npm package so consumers can run a minimal `y-websocket`-compatible Yjs server without adding another backend dependency.

## Files

- `index.js`: minimal websocket server compatible with `y-websocket`
- `package.json`: runtime dependencies and `npm run start`

## Start

```bash
cd yjs
npm install
npm run start
```

By default the server listens on `ws://0.0.0.0:1234`.

To override host or port:

```bash
HOST=0.0.0.0 PORT=1234 npm run start
```

PowerShell:

```powershell
$env:HOST="0.0.0.0"
$env:PORT="1234"
npm run start
```

## Client Link Example

```ts
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

const ydoc = new Y.Doc()
const provider = new WebsocketProvider('ws://127.0.0.1:1234', 'office-word-demo', ydoc)
```

```vue
<RichTextEditor
  v-model="content"
  :collaboration="{
    document: ydoc,
    field: 'content',
    provider,
    user: {
      name: '张三',
      color: '#3b82f6',
    },
  }"
/>
```

## Notes

- all collaborators must use the same websocket address and the same room name
- if clients are on different machines, do not use `127.0.0.1`; use the server's real LAN or public address
- this sample server is in-memory only; document state is lost after restart
