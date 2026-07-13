/**
 * formatter.mjs — Transforms raw element data into the clipboard-ready text format.
 *
 * @typedef {Object} ElementData
 * @property {string} tagName
 * @property {string|null} id
 * @property {string|null} className
 * @property {string} outerHTML
 * @property {string} innerText
 * @property {Object<string,string>} computedStyles
 * @property {Object<string,string>} attributes
 * @property {{ position: {x:number,y:number}, size: {width:number,height:number} }} dimensions
 * @property {string[]} ancestors
 * @property {string} url
 */

/**
 * Format the element description line: div#hero.section-banner
 */
function formatElementLine(data) {
  let desc = data.tagName;
  if (data.id) desc += '#' + data.id;
  if (data.className) {
    const classes = data.className.trim().split(/\s+/).filter(Boolean);
    if (classes.length) desc += '.' + classes.join('.');
  }
  return desc;
}

/**
 * Format the ancestor path: body > div#app > main > div#hero.section-banner
 */
function formatPath(data) {
  return data.ancestors.join(' > ');
}

/**
 * Format computed styles as CSS property lines
 */
function formatStyles(styles) {
  return Object.entries(styles)
    .map(([prop, val]) => `${prop}: ${val};`)
    .join('\n');
}

/**
 * Format dimensions section
 */
function formatDimensions(dims) {
  const lines = [];
  lines.push(`- Position: (${dims.position.x}, ${dims.position.y})`);
  lines.push(`- Size: ${dims.size.width} × ${dims.size.height}px`);
  return lines.join('\n');
}

/**
 * Format the complete element data into clipboard-ready text.
 *
 * @param {ElementData} data
 * @returns {string}
 */
export function formatElement(data) {
  const parts = [];

  parts.push('## DOM Element Context');
  parts.push('');
  parts.push(`**Element**: ${formatElementLine(data)}`);
  parts.push(`**Path**: ${formatPath(data)}`);
  parts.push(`**URL**: ${data.url}`);
  parts.push('');

  // Outer HTML
  parts.push('### Outer HTML');
  parts.push('```html');
  parts.push(data.outerHTML.trim());
  parts.push('```');
  parts.push('');

  // Computed Styles
  const stylesStr = formatStyles(data.computedStyles);
  if (stylesStr) {
    parts.push('### Computed Styles');
    parts.push('```css');
    parts.push(stylesStr);
    parts.push('```');
    parts.push('');
  }

  // Dimensions
  parts.push('### Dimensions');
  parts.push(formatDimensions(data.dimensions));

  return parts.join('\n');
}
