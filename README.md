# dom-pick

Lightweight DOM element picker that captures element context for AI assistants.

Opens a Chromium window, lets you hover and click to select any DOM element, then copies structured HTML + CSS context to your clipboard — ready to paste into Claude Code, Copilot, or any AI chat.

## Install

```bash
git clone <repo> ~/dom-pick
cd ~/dom-pick
npm install
npm link
```

## Usage

```bash
dom-pick http://localhost:3000
```

1. Chromium opens with your URL
2. Press **Ctrl+Shift+C** to activate the picker (crosshair cursor)
3. Hover over any element — blue overlay highlights it
4. **Click** to capture — element context is copied to your clipboard
5. Paste (**Ctrl+V**) into Claude Code, Copilot, or any AI assistant
6. Press **Escape** to exit picker mode, **Ctrl+Shift+C** to re-activate

## What Gets Copied

```
## DOM Element Context

**Element**: div#hero.section-banner
**Path**: body > div#app > main > div#hero.section-banner
**URL**: http://localhost:3000

### Outer HTML
```html
<div id="hero" class="section-banner bg-gradient">
  <h1 class="title text-4xl">Hello World</h1>
</div>
```

### Computed Styles
```css
display: flex;
flex-direction: column;
padding: 2rem;
```

### Dimensions
- Position: (0, 0)
- Size: 1200 × 400px
```

## LazyVim Keybinding

```lua
-- ~/.config/nvim/lua/config/keymaps.lua
vim.keymap.set('n', '<leader>bp', function()
  local url = vim.fn.input('URL: ', 'http://localhost:3000')
  if url ~= '' then
    vim.fn.jobstart({ 'dom-pick', url }, { detached = true })
  end
end, { desc = 'DOM Pick — open browser picker' })
```

## Clipboard Requirements

Requires `xclip` or `xsel` for clipboard access on Linux:

```bash
# Debian/Ubuntu
sudo apt install xclip

# Arch
sudo pacman -S xclip
```

If neither is installed, output is printed to stdout.

## Dependencies

- **playwright** — browser automation (uses system Chromium)
- **Node.js** >= 18

## License

MIT
