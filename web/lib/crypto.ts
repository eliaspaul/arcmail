import CryptoJS from 'crypto-js';

export function encryptMessage(message: string, secret: string): string {
  return CryptoJS.AES.encrypt(message, secret.toLowerCase()).toString();
}

export function decryptMessage(encrypted: string, secret: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, secret.toLowerCase());
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return '[Could not decrypt message]';
  }
}
