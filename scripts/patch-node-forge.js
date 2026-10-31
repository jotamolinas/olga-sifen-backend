const fs = require('fs');
const path = require('path');

function findAndPatchFiles(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findAndPatchFiles(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.cjs'))) {
      try {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('Only 8, 16, 24, or 32 bits supported')) {
          console.log(`[patch-node-forge] Encontrado archivo para parchar: ${fullPath}`);

          // Patrón 1: function s(e){if(8!==e&&16!==e&&24!==e&&32!==e)throw new Error("Only 8, 16, 24, or 32 bits supported: "+e)}
          content = content.replace(
            /8\s*!==\s*([a-zA-Z0-9_$]+)\s*&&\s*16\s*!==\s*\1\s*&&\s*24\s*!==\s*\1\s*&&\s*32\s*!==\s*\1/g,
            '8 !== $1 && 16 !== $1 && 24 !== $1 && 32 !== $1 && 40 !== $1'
          );

          // Patrón 2: if(!(n === 8 || n === 16 || n === 24 || n === 32))
          content = content.replace(
            /!\s*\(\s*([a-zA-Z0-9_$]+)\s*===\s*8\s*\|\|\s*\1\s*===\s*16\s*\|\|\s*\1\s*===\s*24\s*\|\|\s*\1\s*===\s*32\s*\)/g,
            '!($1 === 8 || $1 === 16 || $1 === 24 || $1 === 32 || $1 === 40)'
          );

          // Patrón 3: n !== 8 && n !== 16 && n !== 24 && n !== 32
          content = content.replace(
            /([a-zA-Z0-9_$]+)\s*!==\s*8\s*&&\s*\1\s*!==\s*16\s*&&\s*\1\s*!==\s*24\s*&&\s*\1\s*!==\s*32/g,
            '$1 !== 8 && $1 !== 16 && $1 !== 24 && $1 !== 32 && $1 !== 40'
          );

          // Patrón 4: if (!(e === 8 ...
          content = content.replace(
            /throw\s+new\s+Error\s*\(\s*["']Only 8, 16, 24, or 32 bits supported:\s*["']\s*\+\s*([a-zA-Z0-9_$]+)\s*\)/g,
            'if ($1 === 40) return; throw new Error("Only 8, 16, 24, or 32 bits supported: " + $1)'
          );

          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`[patch-node-forge] Parche aplicado con éxito en: ${fullPath}`);
        }
      } catch (err) {
        console.warn(`[patch-node-forge] No se pudo procesar ${fullPath}:`, err.message);
      }
    }
  }
}

console.log('=== Iniciando parche postinstall para node-forge ===');
const baseNodeModules = path.join(process.cwd(), 'node_modules');
if (fs.existsSync(baseNodeModules)) {
  findAndPatchFiles(baseNodeModules);
} else {
  console.log('[patch-node-forge] node_modules no existe en esta etapa (se ejecutará durante npm install).');
}
console.log('=== Parche postinstall completado ===');
