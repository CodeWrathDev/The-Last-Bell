// Static import check: every relative import must resolve and every named import must be exported. Run: node tools/check-imports.mjs
import fs from 'node:fs'; import path from 'node:path';
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') && files.push(p); } })('src');
const exportsOf = (p) => { const s = fs.readFileSync(p, 'utf8'); const out = new Set(); let m;
  for (const re of [/export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z0-9_$]+)/g]) while ((m = re.exec(s))) out.add(m[1]);
  const re2 = /export\s*\{([^}]+)\}/g; while ((m = re2.exec(s))) m[1].split(',').forEach((x) => out.add(x.split(/\s+as\s+/).pop().trim()));
  return out; };
let bad = 0;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8'); const re = /import\s+(?:([A-Za-z0-9_$]+)\s*,?\s*)?(?:\{([^}]*)\})?\s*(?:\*\s+as\s+\w+\s*)?from\s+'([^']+)'/g; let m;
  while ((m = re.exec(s))) {
    if (!m[3].startsWith('.')) continue;
    const t = path.resolve(path.dirname(f), m[3]);
    if (!fs.existsSync(t)) { console.error(`MISSING ${f}: ${m[3]}`); bad++; continue; }
    if (m[2]) { const ex = exportsOf(t); for (const n of m[2].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) if (!ex.has(n)) { console.error(`NO EXPORT ${n} in ${m[3]} (imported by ${f})`); bad++; } }
  }
}
console.log(bad ? bad + ' problem(s)' : `imports OK (${files.length} files)`); process.exit(bad ? 1 : 0);
