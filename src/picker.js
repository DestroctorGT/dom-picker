/**
 * picker.js — Injected into the browser page via Playwright's addInitScript().
 * This is pure browser JavaScript — no Node APIs, no imports.
 *
 * Listens for Ctrl+Shift+C to toggle picker mode.
 * On hover: shows a blue semi-transparent overlay.
 * On click: captures element data and sends it to Node via window.__notifyElementSelected().
 * Escape exits picker mode.
 */
(function () {
  'use strict';

  // Avoid double-injection
  if (window.__DOM_PICKER_ACTIVE__) return;
  window.__DOM_PICKER_ACTIVE__ = true;

  let active = false;
  let overlay = null;
  let infoBadge = null;

  // ── CSS properties to capture ──────────────────────────────────────
  const RELEVANT_CSS_PROPS = [
    'display', 'position', 'top', 'right', 'bottom', 'left',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'margin', 'padding',
    'background', 'background-color', 'background-image',
    'color', 'font-family', 'font-size', 'font-weight', 'line-height',
    'text-align', 'text-decoration',
    'border', 'border-radius',
    'box-shadow', 'opacity', 'z-index',
    'flex', 'flex-direction', 'justify-content', 'align-items', 'gap',
    'grid-template-columns', 'grid-template-rows',
    'overflow', 'cursor',
  ];

  // ── Create overlay element ─────────────────────────────────────────
  function createOverlay() {
    const el = document.createElement('div');
    el.id = '__dom_picker_overlay__';
    Object.assign(el.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483647',
      border: '2px solid rgba(59, 130, 246, 0.8)',
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      borderRadius: '2px',
      transition: 'none',
      display: 'none',
    });
    document.documentElement.appendChild(el);
    return el;
  }

  // ── Create info badge ──────────────────────────────────────────────
  function createInfoBadge() {
    const el = document.createElement('div');
    el.id = '__dom_picker_badge__';
    Object.assign(el.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483647',
      backgroundColor: 'rgba(59, 130, 246, 0.9)',
      color: '#fff',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: '2px 6px',
      borderRadius: '3px',
      whiteSpace: 'nowrap',
      display: 'none',
    });
    document.documentElement.appendChild(el);
    return el;
  }

  // ── Detect framework component name ────────────────────────────────
  function getComponentName(el) {
    // React — property name is randomized per session (e.g. __reactFiber$abc123)
    for (const key of Object.keys(el)) {
      if (key.startsWith('__reactFiber$')) {
        let fiber = el[key];
        while (fiber) {
          if (fiber.type && typeof fiber.type === 'function') {
            const name = fiber.type.displayName || fiber.type.name;
            if (name && name !== 'ForwardRef' && name !== 'Memo') {
              return name;
            }
          }
          fiber = fiber.return;
        }
        break;
      }
    }

    // Vue 3
    if (el.__vueParentComponent) {
      const name = el.__vueParentComponent.type?.name;
      if (name) return name;
    }

    // Vue 2
    if (el.__vue__) {
      const name = el.__vue__.$options?.name;
      if (name) return name;
    }

    return null;
  }

  // ── Highlight overlay on hovered element ────────────────────────────
  function handleMouseMove(e) {
    if (!active) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === overlay || el === infoBadge) return;

    const rect = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';

    // Show component name or tag name badge
    const componentName = getComponentName(el);
    const label = componentName
      || (el.tagName.toLowerCase()
        + (el.id ? '#' + el.id : '')
        + (el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
          : ''));
    infoBadge.textContent = label;
    infoBadge.style.display = 'block';
    infoBadge.style.top = Math.max(rect.top - 22, 0) + 'px';
    infoBadge.style.left = rect.left + 'px';
  }

  // ── Build ancestor chain ───────────────────────────────────────────
  function getAncestorChain(el) {
    const chain = [];
    let current = el;
    while (current && current !== document.documentElement) {
      let desc = current.tagName.toLowerCase();
      if (current.id) desc += '#' + current.id;
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(Boolean);
        if (classes.length) desc += '.' + classes.join('.');
      }
      chain.unshift(desc);
      current = current.parentElement;
    }
    chain.unshift('html');
    return chain;
  }

  // ── Capture element data ───────────────────────────────────────────
  function captureElement(el) {
    const computed = window.getComputedStyle(el);

    // Relevant styles (only non-default values)
    const styles = {};
    for (const prop of RELEVANT_CSS_PROPS) {
      const val = computed.getPropertyValue(prop);
      if (val && val !== '' && val !== 'none' && val !== 'auto' && val !== '0px' && val !== 'normal') {
        styles[prop] = val;
      }
    }

    // Attributes
    const attributes = {};
    for (const attr of el.attributes || []) {
      attributes[attr.name] = attr.value;
    }

    // Dimensions
    const rect = el.getBoundingClientRect();

    return {
      tagName: el.tagName.toLowerCase(),
      id: el.id || null,
      className: (typeof el.className === 'string' && el.className) || null,
      outerHTML: el.outerHTML,
      innerText: (el.innerText || '').substring(0, 500),
      computedStyles: styles,
      attributes,
      dimensions: {
        position: { x: Math.round(rect.x), y: Math.round(rect.y) },
        size: { width: Math.round(rect.width), height: Math.round(rect.height) },
      },
      ancestors: getAncestorChain(el),
      url: window.location.href,
    };
  }

  // ── Click handler — capture and send ───────────────────────────────
  function handleClick(e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === overlay || el === infoBadge) return;

    const data = captureElement(el);

    // Send data to Node process
    if (typeof window.__notifyElementSelected === 'function') {
      window.__notifyElementSelected(data);
    }

    // Brief flash to confirm capture
    overlay.style.backgroundColor = 'rgba(34, 197, 94, 0.3)';
    overlay.style.borderColor = 'rgba(34, 197, 94, 0.8)';
    setTimeout(() => {
      overlay.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
      overlay.style.borderColor = 'rgba(59, 130, 246, 0.8)';
    }, 200);
  }

  // ── Toggle picker mode ─────────────────────────────────────────────
  function activate() {
    active = true;
    document.body.style.cursor = 'crosshair';
    console.log('[dom-pick] Picker activated — hover and click to capture');
  }

  function deactivate() {
    active = false;
    document.body.style.cursor = '';
    if (overlay) overlay.style.display = 'none';
    if (infoBadge) infoBadge.style.display = 'none';
    console.log('[dom-pick] Picker deactivated');
  }

  // ── Keyboard listener ──────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+C — toggle picker
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
      e.preventDefault();
      e.stopPropagation();
      if (active) {
        deactivate();
      } else {
        activate();
      }
      return;
    }

    // Escape — exit picker mode
    if (e.key === 'Escape' && active) {
      e.preventDefault();
      deactivate();
    }
  }, true);

  // ── Mouse listeners ────────────────────────────────────────────────
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);

  // Prevent default context menu in picker mode
  document.addEventListener('contextmenu', (e) => {
    if (active) e.preventDefault();
  }, true);

  // ── Initialize DOM elements ────────────────────────────────────────
  function init() {
    if (!overlay) overlay = createOverlay();
    if (!infoBadge) infoBadge = createInfoBadge();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also re-init on SPA navigation (popstate / pushState)
  window.addEventListener('popstate', init);
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function () {
    origPush.apply(this, arguments);
    setTimeout(init, 0);
  };
  history.replaceState = function () {
    origReplace.apply(this, arguments);
    setTimeout(init, 0);
  };

})();
