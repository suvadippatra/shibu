/* AES-256-GCM Password-Protected Watermark Vault (Web Crypto PBKDF2 + AES-GCM) */
import { sha256Hex } from './dom.js';

export const DEFAULT_WM_HASH = 'd89c34cb1d5083183db108522761b3bec45ac9cb159da982121ee4b4e934297c';

// Populated by `node scripts/seal-watermark.mjs` when hiding watermark.svg from public repos.
export const ENCRYPTED_DEFAULT_WM = null;

let _unlockedSvgText = null;
let _unlockedDataUrl = null;

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(bin);
}

async function deriveAesKey(password, saltBytes, usage) {
  const enc = new TextEncoder();
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage]
  );
}

export async function encryptWatermarkPayload(svgText, password) {
  const enc = new TextEncoder();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt, 'encrypt');
  const cipherBuf = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(svgText)
  );
  return {
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    data: bytesToB64(new Uint8Array(cipherBuf))
  };
}

export async function decryptWatermarkPayload(payload, password) {
  if (!payload || !payload.salt || !payload.iv || !payload.data) {
    throw new Error('Encrypted watermark payload is missing.');
  }
  const salt = b64ToBytes(payload.salt);
  const iv = b64ToBytes(payload.iv);
  const cipherBytes = b64ToBytes(payload.data);
  const key = await deriveAesKey(password, salt, 'decrypt');
  const plainBuf = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBytes
  );
  return new TextDecoder().decode(plainBuf);
}

function svgToDataUrl(svgText) {
  const bytes = new TextEncoder().encode(svgText);
  return `data:image/svg+xml;base64,${bytesToB64(bytes)}`;
}

export function isVaultEncrypted() {
  return Boolean(ENCRYPTED_DEFAULT_WM && ENCRYPTED_DEFAULT_WM.data);
}

export function isWatermarkUnlocked() {
  return Boolean(_unlockedSvgText && _unlockedDataUrl);
}

export function getUnlockedWatermarkSvg() {
  return _unlockedSvgText;
}

export function getUnlockedWatermarkDataUrl() {
  return _unlockedDataUrl;
}

export async function unlockDefaultWatermark(password, fallbackUrl = '../watermark.svg') {
  const cleanPwd = String(password || '').trim();
  if (!cleanPwd) return false;

  if (isVaultEncrypted()) {
    try {
      const svgText = await decryptWatermarkPayload(ENCRYPTED_DEFAULT_WM, cleanPwd);
      if (!/<svg[\s>]/i.test(svgText)) return false;
      _unlockedSvgText = svgText;
      _unlockedDataUrl = svgToDataUrl(svgText);
      return true;
    } catch (_) {
      return false;
    }
  }

  // Fallback when watermark.svg has not been sealed yet
  const hash = await sha256Hex(cleanPwd);
  if (hash !== DEFAULT_WM_HASH) return false;
  try {
    const res = await fetch(fallbackUrl);
    if (!res.ok) return false;
    const svgText = await res.text();
    if (!/<svg[\s>]/i.test(svgText)) return false;
    _unlockedSvgText = svgText;
    _unlockedDataUrl = svgToDataUrl(svgText);
    return true;
  } catch (_) {
    return false;
  }
}
