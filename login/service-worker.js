/* eslint-env serviceworker */
/* global crypto */
/**
 * Decrypts ciphertext encrypted with aesGcmEncrypt() using supplied password.
 * (c) Chris Veness MIT Licence
 *
 * @param   {String} ciphertext - Ciphertext to be decrypted.
 * @param   {String} password - Password to use to decrypt ciphertext.
 * @returns {String} Decrypted plaintext.
 *
 * @example
 *   const plaintext = await aesGcmDecrypt(ciphertext, 'pw');
 *   aesGcmDecrypt(ciphertext, 'pw').then(function(plaintext) { console.log(plaintext); });
 *
 * @link https://gist.github.com/chrisveness/43bcda93af9f646d083fad678071b90a
 */
async function aesGcmDecrypt(ciphertext, password) {
  const pwUtf8 = new TextEncoder().encode(password); // encode password as UTF-8
  const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8); // hash the password

  const ivStr = atob(ciphertext).slice(0, 12); // decode base64 iv
  const iv = new Uint8Array(Array.from(ivStr).map((ch) => ch.charCodeAt(0))); // iv as Uint8Array

  const alg = { name: 'AES-GCM', iv: iv }; // specify algorithm to use

  const key = await crypto.subtle.importKey('raw', pwHash, alg, false, [
    'decrypt',
  ]); // generate key from pw

  const ctStr = atob(ciphertext).slice(12); // decode base64 ciphertext
  const ctUint8 = new Uint8Array(
    Array.from(ctStr).map((ch) => ch.charCodeAt(0))
  ); // ciphertext as Uint8Array
  // note: why doesn't ctUint8 = new TextEncoder().encode(ctStr) work?

  try {
    const plainBuffer = await crypto.subtle.decrypt(alg, key, ctUint8); // decrypt ciphertext using key
    const plaintext = new TextDecoder().decode(plainBuffer); // plaintext from ArrayBuffer
    return plaintext; // return the plaintext
  } catch (e) {
    throw new Error('Decrypt failed');
  }
}

let password;
async function decryptContent(response) {
  const ciphertext = await response.text();
  const chunks = ciphertext.split('--CHUNK--').filter(Boolean);

  let decrypted = '';
  for (const chunk of chunks) {
    decrypted += await aesGcmDecrypt(chunk, password);
  }

  const { status, statusText, headers } = response;
  return new Response(decrypted, {
    status,
    statusText,
    headers,
  });
}

// This regexp is manipulated by Gulp to add the necessary values
const decryptUrlRegExp = new RegExp(
  '__APP_FOLDER__/.+\\.(__ENCRYPT_EXTENSIONS__)(#.*)?$'
);

self.addEventListener('install', function () {
  // The promise that skipWaiting() returns can be safely ignored.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (!password) return;

  if (url.match(decryptUrlRegExp)) {
    event.respondWith(fetch(url).then(decryptContent));
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_PASSWORD') {
    password = event.data.password;
    // Reply to tell we are ready to process requests
    event.source.postMessage({ type: 'PASSWORD_SET' });
  }
});
