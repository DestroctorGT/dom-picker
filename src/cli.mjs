import { execSync } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { formatElement } from './formatter.mjs';

// ── Clipboard helpers ────────────────────────────────────────────────

function copyToClipboard(text) {
  // Try xclip first, then xsel, then fall back to stdout
  const commands = [
    (t) => { execSync('xclip -selection clipboard', { input: t, stdio: 'pipe' }); },
    (t) => { execSync('xsel --clipboard --input', { input: t, stdio: 'pipe' }); },
  ];

  for (const cmd of commands) {
    try {
      cmd(text);
      return true;
    } catch {
      // try next
    }
  }

  // No clipboard tool found — print to stdout
  return false;
}

// ── Arg parsing ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = { url: null, help: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if (arg === '--url' && args[i + 1]) {
      result.url = args[++i];
    } else if (!arg.startsWith('-')) {
      result.url = arg;
    }
  }

  return result;
}

function showHelp() {
  console.log(`
  dom-pick — Lightweight DOM element picker for AI assistants

  USAGE
    dom-pick <url>
    dom-pick --url <url>
    dom-pick -h | --help

  EXAMPLES
    dom-pick http://localhost:3000
    dom-pick https://example.com

  HOW TO USE
    1. Opens a Chromium window with the given URL
    2. Press Ctrl+Shift+C to activate the picker
    3. Hover over an element — it highlights with a blue overlay
    4. Click to capture — element context is copied to your clipboard
    5. Paste (Ctrl+V) into Claude Code, Copilot, or any AI assistant
    6. Press Escape to exit picker mode, then Ctrl+Shift+C to re-activate

  CLIPBOARD
    Copies formatted element context (HTML, computed styles, dimensions)
    using xclip or xsel. Falls back to stdout if neither is installed.
`);
}

// ── Main ─────────────────────────────────────────────────────────────

export async function run() {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    showHelp();
    process.exit(0);
  }

  if (!opts.url) {
    console.error('Error: URL is required');
    console.error('Usage: dom-pick <url>');
    console.error('Run "dom-pick --help" for more info');
    process.exit(1);
  }

  // Validate URL format
  try {
    new URL(opts.url);
  } catch {
    console.error(`Error: Invalid URL "${opts.url}"`);
    console.error('Please provide a valid URL (e.g., http://localhost:3000)');
    process.exit(1);
  }

  console.log(`\n  dom-pick — Opening ${opts.url}\n`);

  let selectionCount = 0;

  try {
    const browser = await launchBrowser(opts.url, (data) => {
      selectionCount++;
      const formatted = formatElement(data);
      const copied = copyToClipboard(formatted);

      if (copied) {
        console.log(`  ✓ Element #${selectionCount} copied to clipboard`);
      } else {
        console.log(`\n  ── Element #${selectionCount} (no clipboard tool found, printing) ──\n`);
        console.log(formatted);
        console.log('');
      }
    });

    // Graceful shutdown on Ctrl+C
    process.on('SIGINT', async () => {
      console.log('\n\n  Shutting down...');
      await browser.close();
      process.exit(0);
    });

    // Keep the process alive
    await new Promise(() => {});

  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
