const gulp = require('gulp');
const gulpClean = require('gulp-clean');
const tap = require('gulp-tap');
const md5 = require('md5');

const { Crypto } = require('node-webcrypto-ossl');

const crypto = new Crypto();

const appFolder = 'app';
const srcFolder = `${appFolder}/**/*`;
const destFolder = 'dist';
// Specify a list of files extensions whose content is to be encrypted
const encryptExtensions = ['.js', '.css', '.html'];

function clean() {
  return gulp
    .src(destFolder, { read: false, allowEmpty: true })
    .pipe(gulpClean());
}

/**
 * The protect task will make a copy of contents while encrypting the
 * files with the extensions matching the given list
 */
function protect() {
  const password = process.env.PROTECT_STATIC_KEY;

  if (!password) {
    return Promise.reject(
      'Please set a PROTECT_STATIC_KEY environment variable with the password to use for encryption'
    );
  }

  return new Promise((resolve, reject) => {
    const stream = gulp.src(srcFolder).pipe(
      tap(async (file) => {
        if (encryptExtensions.includes(file.extname)) {
          file.contents = Buffer.from(
            await aesGcmEncrypt(file.contents.toString(), password)
          );

          resolve(stream);
        } else {
          resolve(stream);
        }
      })
    );
  }).then((stream) => stream.pipe(gulp.dest(`${destFolder}/${appFolder}`)));
}

function copyLogin() {
  return gulp
    .src(['index.html', 'service-worker.js'])
    .pipe(gulp.dest(destFolder));
}

function giveInfo(done) {
  hashHex = md5(process.env.PROTECT_STATIC_KEY);

  console.log(`Add this hash to the login URL: #${hashHex}`);

  done();
}

exports.protect = protect;
exports.default = gulp.series(clean, protect, copyLogin, giveInfo);

/**
 * Encrypts plaintext using AES-GCM with supplied password, for decryption with aesGcmDecrypt().
 *                                                                      (c) Chris Veness MIT Licence
 *
 * @param   {String} plaintext - Plaintext to be encrypted.
 * @param   {String} password - Password to use to encrypt plaintext.
 * @returns {String} Encrypted ciphertext.
 *
 * @example
 *   const ciphertext = await aesGcmEncrypt('my secret text', 'pw');
 *   aesGcmEncrypt('my secret text', 'pw').then(function(ciphertext) { console.log(ciphertext); });
 */
async function aesGcmEncrypt(plaintext, password) {
  const pwUtf8 = new TextEncoder().encode(password); // encode password as UTF-8
  const pwHash = await crypto.subtle.digest('SHA-256', pwUtf8); // hash the password

  const iv = crypto.getRandomValues(new Uint8Array(12)); // get 96-bit random iv
  const alg = { name: 'AES-GCM', iv: iv }; // specify algorithm to use
  const key = await crypto.subtle.importKey('raw', pwHash, alg, false, [
    'encrypt',
  ]); // generate key from pw

  const ptUint8 = new TextEncoder().encode(plaintext); // encode plaintext as UTF-8
  const ctBuffer = await crypto.subtle.encrypt(alg, key, ptUint8); // encrypt plaintext using key

  return (
    Buffer.from(iv).toString('base64') +
    Buffer.from(new Uint8Array(ctBuffer)).toString('base64')
  );
}
