/**
 * detector.mjs — Auto-detect running dev server ports.
 *
 * Scans common frontend dev server ports and returns the first
 * one that responds to an HTTP request.
 */

const COMMON_PORTS = [
  // Vite
  5173, 5174,
  // React (CRA / Next.js)
  3000, 3001,
  // Angular
  4200, 4201,
  // Vue CLI
  8080, 8081,
  // General
  8000, 8001,
];

/**
 * Try to connect to a port and check if it's an HTTP server.
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function isPortOpen(port, timeoutMs = 800) {
  try {
    const res = await fetch(`http://localhost:${port}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.status < 500; // Any 2xx/3xx/4xx means a server is there
  } catch {
    return false;
  }
}

/**
 * Scan common dev server ports and return all that are open.
 * @returns {Promise<number[]>}
 */
export async function detectPorts() {
  const open = [];
  // Run all checks in parallel for speed
  const results = await Promise.all(
    COMMON_PORTS.map(async (port) => ({
      port,
      open: await isPortOpen(port),
    }))
  );
  for (const { port, open: isOpen } of results) {
    if (isOpen) open.push(port);
  }
  return open;
}
