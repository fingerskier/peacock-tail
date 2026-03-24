import { readFile, stat } from 'node:fs/promises';

export function createTail(filePath, intervalMs, onNewContent) {
  let lastSize = 0;
  let running = true;

  async function init() {
    try {
      const info = await stat(filePath);
      lastSize = info.size;
    } catch {
      lastSize = 0;
    }
  }

  async function poll() {
    if (!running) return;

    try {
      const info = await stat(filePath);

      if (info.size > lastSize) {
        const buf = Buffer.alloc(info.size - lastSize);
        const fh = await (await import('node:fs/promises')).open(filePath, 'r');
        await fh.read(buf, 0, buf.length, lastSize);
        await fh.close();

        lastSize = info.size;
        const newContent = buf.toString('utf-8');
        await onNewContent(newContent);
      } else if (info.size < lastSize) {
        // File was truncated/rotated — read from start
        lastSize = 0;
      }
    } catch (err) {
      console.error('Tail error:', err.message);
    }

    if (running) {
      setTimeout(poll, intervalMs);
    }
  }

  init().then(() => {
    // Read initial content (last 4KB or whole file if smaller)
    readFile(filePath, 'utf-8').then(content => {
      const initial = content.length > 4096 ? content.slice(-4096) : content;
      onNewContent(initial).then(() => {
        setTimeout(poll, intervalMs);
      });
    }).catch(() => {
      setTimeout(poll, intervalMs);
    });
  });

  return {
    stop() {
      running = false;
    }
  };
}
