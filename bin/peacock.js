#!/usr/bin/env node

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createTail } from '../src/tail.js';
import { createAnalyzer } from '../src/analyzer.js';
import { startServer } from '../src/server.js';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
  peacock-tail - A log tail visualizer

  Usage:
    npx peacock-tail <logfile> [options]

  Options:
    --port <port>    Port for web UI (default: 3456)
    --interval <ms>  Tail polling interval in ms (default: 3000)
    -h, --help       Show this help
  `);
  process.exit(0);
}

const logFile = resolve(args[0]);
if (!existsSync(logFile)) {
  console.error(`Error: file not found: ${logFile}`);
  process.exit(1);
}

const portIdx = args.indexOf('--port');
const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 3456;

const intervalIdx = args.indexOf('--interval');
const interval = intervalIdx !== -1 ? parseInt(args[intervalIdx + 1], 10) : 3000;

console.log(`Peacock watching: ${logFile}`);
console.log(`Web UI: http://localhost:${port}`);

const analyzer = createAnalyzer();
const { broadcast, server } = await startServer(port, () => analyzer.getState());

const tail = createTail(logFile, interval, async (newLines) => {
  if (newLines.trim().length === 0) return;

  const result = await analyzer.analyze(newLines);
  broadcast(result);
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  tail.stop();
  server.close();
  process.exit(0);
});
