import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { encryptWatermarkPayload, DEFAULT_WM_HASH } from '../shared/js/watermark-vault.js';
import { sha256Hex } from '../shared/js/dom.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const svgPath = path.join(root, 'watermark.svg');
const vaultPath = path.join(root, 'shared/js/watermark-vault.js');

if (!fs.existsSync(svgPath)) {
  console.error('watermark.svg not found at repo root.');
  process.exit(1);
}

const rl = readline.createInterface({ input, output });
const pwd = (await rl.question('Enter watermark encryption password: ')).trim();
rl.close();

if (!pwd) {
  console.error('Password cannot be empty.');
  process.exit(1);
}

const hash = await sha256Hex(pwd);
if (hash !== DEFAULT_WM_HASH) {
  console.log('Note: Entered password differs from legacy DEFAULT_WM_HASH; encrypting with your new password.');
}

const svgText = fs.readFileSync(svgPath, 'utf8');
const payload = await encryptWatermarkPayload(svgText, pwd);
let vaultSrc = fs.readFileSync(vaultPath, 'utf8');
vaultSrc = vaultSrc.replace(
  /export const ENCRYPTED_DEFAULT_WM = [^;]+;/,
  `export const ENCRYPTED_DEFAULT_WM = ${JSON.stringify(payload)};`
);
fs.writeFileSync(vaultPath, vaultSrc, 'utf8');
fs.unlinkSync(svgPath);
console.log('Success! watermark.svg encrypted into shared/js/watermark-vault.js and plaintext watermark.svg deleted.');
