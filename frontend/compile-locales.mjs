import {parse} from '@formatjs/icu-messageformat-parser';
import {readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync} from 'fs';
import {join} from 'path';

const srcDir = './src/locale/src';
const langDir = './src/locale/lang';

if (!existsSync(langDir)) {
  mkdirSync(langDir, {recursive: true});
}

const files = readdirSync(srcDir).filter(f => f.endsWith('.json') && f !== 'lang-list.json');

let totalFiles = 0;
let totalKeys = 0;
let totalErrors = 0;

for (const file of files) {
  const srcPath = join(srcDir, file);
  const langPath = join(langDir, file);
  
  try {
    const src = JSON.parse(readFileSync(srcPath, 'utf8'));
    const compiled = {};
    let fileKeys = 0;
    let fileErrors = 0;
    
    for (const [key, val] of Object.entries(src)) {
      const msg = typeof val === 'string' ? val : (val.defaultMessage || val.message || String(val));
      try {
        compiled[key] = parse(msg);
        fileKeys++;
      } catch (e) {
        // Fallback to plain text if parsing fails
        compiled[key] = [{type: 0, value: msg}];
        fileErrors++;
        console.error(`  WARN: ${file}/${key}: ${e.message}`);
      }
    }
    
    writeFileSync(langPath, JSON.stringify(compiled));
    totalFiles++;
    totalKeys += fileKeys;
    totalErrors += fileErrors;
    console.log(`✓ ${file}: ${fileKeys} keys compiled, ${fileErrors} errors`);
  } catch (e) {
    console.error(`✗ ${file}: ${e.message}`);
  }
}

console.log(`\nDone: ${totalFiles} files, ${totalKeys} keys, ${totalErrors} errors`);
