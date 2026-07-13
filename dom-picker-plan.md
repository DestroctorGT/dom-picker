# Plan: DOM Picker — Navegador Ligero para Frontend Dev

## Contexto

**Workflow actual**: LazyVim + Terminal + Claude Code / Cursor Agent CLI
**Problema**: Cursor IDE es demasiado pesado para la PC. La feature clave que obliga a usarlo es el browser integrado que permite seleccionar un elemento del DOM y enviarlo al chat de Copilot.
**Objetivo**: Un herramienta liviana que replique esa feature sin necesitar un IDE completo.

## Qué necesitamos

Un CLI que:

1. Abra un navegador apuntando a tu URL de desarrollo
2. Inyecte un **element picker** (overlay que resalta elementos al hacer hover)
3. Al hacer click, capture datos estructurados del elemento
4. Copie todo formateado al **clipboard**
5. Vos lo pegás en la terminal cuando quieras (`Ctrl+V` en Claude Code)

Nada más. Sin chat integrado, sin agentes, sin features extra.

## Arquitectura: Playwright CLI

**Por qué Playwright sobre otras opciones:**

| Opción | RAM | Complejidad | Veredicto |
|--------|-----|-------------|-----------|
| Chrome Extension | ~0 | Baja | Menos control, clipboard limitado |
| Electron mini-app | ~80MB | Media | Sigue siendo Electron, pesado |
| **Playwright + Chromium del sistema** | **~50MB** | **Baja** | **✅ Ganador** |
| Puppeteer | ~60MB | Baja | Muy similar a Playwright, menos features |

Playwright usa el Chromium que ya tenés instalado en el sistema. No descarga nada nuevo. Es un solo script Node.js que podés ejecutar desde una keybinding de LazyVim.

## Flujo del usuario

```
1. En la terminal:
   $ dom-pick http://localhost:3000

2. Se abre Chromium (ventana normal, no headless)

3. Navegás a la página que querés inspeccionar

4. Presionás Ctrl+Shift+C → se activa el picker
   (hover resalta elementos, overlay azul semitransparente)

5. Hacés click en el elemento → se captura y copia al clipboard

6. Cerrás el picker con Escape si querés seleccionar otro

7. Volvés a la terminal, pegás en Claude Code:
   $ claude
   > [Ctrl+V] "Fix the padding on this element"
```

## Formato del output en clipboard

Mismo formato que produce VS Code/Cursor, optimizado para que Copilot/Claude entienda el contexto:

```
## DOM Element Context

**Element**: div#hero.section-banner
**Path**: body > div#app > main > div#hero.section-banner
**URL**: http://localhost:3000

### Outer HTML
```html
<div id="hero" class="section-banner bg-gradient">
  <h1 class="title text-4xl">Hello World</h1>
  <p class="subtitle">Welcome to the app</p>
</div>
```

### Computed Styles
```css
display: flex;
flex-direction: column;
padding: 2rem;
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Dimensions
- Position: (0, 0)
- Size: 1200 × 400px
```

## Estructura del proyecto

```
dom-pick/
├── package.json       # Dependencias: playwright
├── bin/
│   └── dom-pick       # Entry point (#!/usr/bin/env node)
├── src/
│   ├── cli.mjs        # Parseo de args, orchestration
│   ├── browser.mjs    # Launch Playwright, manage lifecycle
│   ├── picker.js      # Script inyectado en el browser (overlay + captura)
│   └── formatter.mjs  # IElementData → texto formateado para clipboard
└── README.md          # Instrucciones de uso e instalación
```

### Dependencias

Solo **una**: `playwright`

```json
{
  "name": "dom-pick",
  "version": "0.1.0",
  "type": "module",
  "bin": { "dom-pick": "./bin/dom-pick" },
  "dependencies": {
    "playwright": "^1.49.0"
  }
}
```

## Archivos clave — qué hace cada uno

### `src/browser.mjs` — Gestión del navegador

- Lanza Chromium en modo headed (ventana visible)
- Navega a la URL que pasaste por CLI
- Inyecta `picker.js` en cada carga de página
- Expone eventos para communicatione entre browser y Node

```js
// Uso conceptual
const browser = await launchBrowser('http://localhost:3000');
browser.on('element-selected', (data) => {
  const text = formatElement(data);
  copyToClipboard(text);
  console.log('✓ Element copied to clipboard');
});
```

### `src/picker.js` — El heart del tool (inyectado en el browser)

Este es el script que se inyecta en la página vía Playwright's `page.addInitScript()`. Es lo que hace el picker funcionar:

**Lo que hace:**
1. Escucha `Ctrl+Shift+C` para activar/desactivar
2. Muestra un overlay azul semitransparente sobre el elemento bajo el cursor
3. Al hacer click, captura:
   - `outerHTML` del elemento
   - `computedStyles` (los 20-30 estilos más relevantes)
   - Cadena de ancestros (tag#id.class > tag.class > ...)
   - Dimensiones y posición
   - Atributos HTML
   - Texto interior
4. Envía los datos de vuelta a Node vía `window.__PICK_RESULT__`

**Técnica de captura** (mismo approach que VS Code):
```js
// Extracción de estilos computados relevantes
const relevantProps = [
  'display', 'position', 'width', 'height',
  'padding', 'margin', 'background', 'color',
  'font-size', 'font-weight', 'border', 'flex', ...
];
const styles = getComputedStyle(el);
const cssText = relevantProps
  .map(p => `${p}: ${styles.getPropertyValue(p)}`)
  .filter(s => !s.endsWith(': '))
  .join(';\n');
```

### `src/formatter.mjs` — Formateo para AI

Transforma el `IElementData` crudo en el texto legible que va al clipboard. Este es el que asegura que Claude/Copilot entienda perfectamente el contexto.

## Keybinding en LazyVim

```lua
-- ~/.config/nvim/lua/config/keymaps.lua
vim.keymap.set('n', '<leader>bp', function()
  local url = vim.fn.input('URL: ', 'http://localhost:3000')
  if url ~= '' then
    vim.fn.jobstart({ 'dom-pick', url }, { detached = true })
  end
end, { desc = 'DOM Pick — open browser picker' })
```

O más simple, si ya tenés el browser abierto:

```lua
-- Atajo para lanzar solo si no está corriendo
vim.keymap.set('n', '<leader>bp', function()
  if vim.fn.system('pgrep -f dom-pick') == '' then
    local url = vim.fn.input('URL: ', 'http://localhost:3000')
    vim.fn.jobstart({ 'dom-pick', url }, { detached = true })
  else
    print('dom-pick already running')
  end
end, { desc = 'DOM Pick' })
```

## Instalación

```bash
# Clonar y linkar globalmente
git clone <repo> ~/dom-pick
cd ~/dom-pick
npm install
npm link

# Ahora podés usar desde cualquier terminal:
$ dom-pick http://localhost:3000
```

## Orden de implementación

| Paso | Archivo | Descripción | Dependencias |
|------|---------|-------------|--------------|
| 1 | `package.json` | Setup del proyecto, instalar playwright | Ninguna |
| 2 | `bin/dom-pick` | CLI entry point, parseo de args básicos | package.json |
| 3 | `src/browser.mjs` | Launch Chromium, navigate, inyectar script | package.json |
| 4 | `src/picker.js` | Overlay de selección + captura de datos DOM | Ninguna (se inyecta en browser) |
| 5 | `src/formatter.mjs` | Formatear IElementData → texto para clipboard | Ninguna |
| 6 | Integración | Conectar picker → formatter → clipboard (xclip) | Pasos 3-5 |
| 7 | README | Instrucciones de uso | Todos |

**Paso crítico**: El paso 4 (`picker.js`) es donde está la magia. Es un script vanilla JS que corre en el contexto de la página, no necesita Node ni Playwright — solo el DOM del browser.

## Diferencias con el browser de VS Code/Cursor

| Feature | VS Code/Cursor | dom-pick |
|---------|----------------|----------|
| Selección de elemento | ✅ | ✅ |
| HTML path (ancestros) | ✅ | ✅ |
| Estilos computados | ✅ | ✅ |
| Dimensiones | ✅ | ✅ |
| Screenshot del elemento | ✅ (opcional) | ❌ (futuro) |
| Console logs → chat | ✅ | ❌ (futuro) |
| Share with Agent | ✅ | ❌ (no aplica) |
| RAM usage | ~300MB+ | ~50MB |
| Requiere IDE | Sí | **No** |

## Futuras mejoras (post-MVP)

- **Screenshot del elemento**: Capturar la región del viewport con `page.screenshot({ clip: bounds })` y copiar imagen al clipboard
- **Multi-select**: Seleccionar varios elementos de una vez
- **Console logs**: Capturar logs del browser y pegarlos también
- **Watch mode**: Re-capturar automáticamente si el DOM cambia (HMR)
- **Custom format**: Flag para output en JSON, YAML, o formato custom

## Notas técnicas

- Playwright maneja la comunicación con Chromium vía CDP (Chrome DevTools Protocol) internamente
- El script inyectado (`picker.js`) corre en el contexto aislado de la página — no tiene acceso a Node APIs
- La comunicación del browser → Node es vía `page.exposeFunction()` de Playwright
- Para clipboard en Linux se usa `xclip` o `xsel` (la mayoría de los desktops lo tienen)
- El browser es headed (ventana visible) porque necesitás interactuar con la página
