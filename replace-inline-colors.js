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
  { search: /#0F1115/gi, replace: 'hsl(var(--surface-base))' },
  { search: /#171A21/gi, replace: 'hsl(var(--surface-elevated))' },
  { search: /#262B36/gi, replace: 'hsl(var(--surface-border))' },
  { search: /#F2F3F5/gi, replace: 'hsl(var(--text-primary))' },
  { search: /#9AA1AE/gi, replace: 'hsl(var(--text-secondary))' },
  { search: /#5B6270/gi, replace: 'hsl(var(--muted-foreground))' },
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
    console.log(`Updated inline styles in ${p}`);
  }
});
