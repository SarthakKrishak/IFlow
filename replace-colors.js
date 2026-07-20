const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, callback);
    else callback(p);
  });
}

const replacements = [
  { search: /bg-\[\#0F1115\]/gi, replace: 'bg-surface-base' },
  { search: /bg-\[\#171A21\]/gi, replace: 'bg-surface-elevated' },
  { search: /bg-\[\#262B36\]/gi, replace: 'bg-surface-border' },
  { search: /border-\[\#262B36\]/gi, replace: 'border-surface-border' },
  { search: /divide-\[\#262B36\]/gi, replace: 'divide-surface-border' },
  { search: /text-\[\#F2F3F5\]/gi, replace: 'text-text-primary' },
  { search: /text-\[\#9AA1AE\]/gi, replace: 'text-text-secondary' },
  { search: /text-\[\#5B6270\]/gi, replace: 'text-muted-foreground' },
  { search: /placeholder-\[\#5B6270\]/gi, replace: 'placeholder-muted-foreground' },
  { search: /hover:bg-\[\#171A21\]/gi, replace: 'hover:bg-surface-elevated' },
  { search: /hover:bg-\[\#262B36\]/gi, replace: 'hover:bg-surface-border' },
  { search: /hover:bg-\[\#363D4E\]/gi, replace: 'hover:bg-surface-border\/80' },
  { search: /hover:border-\[\#363D4E\]/gi, replace: 'hover:border-surface-border\/80' },
  { search: /hover:text-\[\#F2F3F5\]/gi, replace: 'hover:text-text-primary' },
  { search: /hover:text-\[\#9AA1AE\]/gi, replace: 'hover:text-text-secondary' },
];

walk('e:/IFlow/src', (p) => {
  if (!p.endsWith('.tsx') && !p.endsWith('.ts')) return;
  let content = fs.readFileSync(p, 'utf8');
  let changed = false;
  replacements.forEach(({search, replace}) => {
    if (search.test(content)) {
      content = content.replace(search, replace);
      changed = true;
    }
  });
  if (changed) {
    fs.writeFileSync(p, content, 'utf8');
    console.log(`Updated ${p}`);
  }
});
