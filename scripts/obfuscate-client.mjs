import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import JavaScriptObfuscator from 'javascript-obfuscator';

const assetsDirectory = path.resolve('dist/assets');
const assetNames = (await readdir(assetsDirectory)).filter((name) => name.endsWith('.js'));

if (assetNames.length === 0) {
  throw new Error('No built frontend JavaScript assets were found to obfuscate.');
}

for (const assetName of assetNames) {
  const assetPath = path.join(assetsDirectory, assetName);
  const source = await readFile(assetPath, 'utf8');
  const obfuscated = JavaScriptObfuscator.obfuscate(source, {
    compact: true,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    rotateStringArray: true,
    selfDefending: false,
    stringArray: true,
    stringArrayThreshold: 0.5,
    transformObjectKeys: false,
    unicodeEscapeSequence: false,
  }).getObfuscatedCode();

  await writeFile(assetPath, obfuscated);
  console.log(`Obfuscated frontend asset: ${assetName}`);
}