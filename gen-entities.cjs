const fs = require('fs');
const path = require('path');

const src = fs.readFileSync('/Users/wreiske/prj/blaze/packages/html-tools/charref.js', 'utf8');

const start = src.indexOf('var ENTITIES = {');
const end = src.indexOf('};', start) + 2;
const block = src.substring(start, end);
const ENTITIES = new Function(block + ' return ENTITIES;')();

const keys = Object.keys(ENTITIES);
console.log('Total entities:', keys.length);

let out = '/** HTML character entity map. Auto-generated from WHATWG spec. */\n';
out += 'export const ENTITIES: Record<string, { codepoints: number[]; characters: string }> = {\n';
for (let i = 0; i < keys.length; i++) {
  const key = keys[i];
  const val = ENTITIES[key];
  const cpArr = JSON.stringify(val.codepoints);
  const charStr = JSON.stringify(val.characters);
  out +=
    '  ' + JSON.stringify(key) + ': { codepoints: ' + cpArr + ', characters: ' + charStr + ' }';
  if (i < keys.length - 1) out += ',';
  out += '\n';
}
out += '};\n';

const outPath = path.join(
  '/Users/wreiske/prj/blaze-typescript',
  'packages/html-tools/src/entities.ts',
);
fs.writeFileSync(outPath, out);
console.log('Done, wrote', out.split('\n').length, 'lines to', outPath);
