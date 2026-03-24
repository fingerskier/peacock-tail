import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WebSocketServer } from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function startServer(port, getState) {
  const indexHtml = await readFile(join(__dirname, 'public', 'index.html'), 'utf-8');

  const server = createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(indexHtml);
    } else if (req.url === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getState()));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    // Send current state on connect
    const state = getState();
    if (state.lastUpdated) {
      ws.send(JSON.stringify(state));
    }
  });

  function broadcast(data) {
    const msg = JSON.stringify(data);
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(msg);
      }
    }
  }

  server.listen(port);

  return { broadcast, server };
}
