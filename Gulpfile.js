const gulp = require('gulp');
const gulpClean = require('gulp-clean');
const tap = require('gulp-tap');

const srcFolder = 'app/**/*';
const destFolder = 'dist';
// Specify a list of files extensions whose content is to be encrypted
const encryptExtensions = ['.js', '.css', '.html'];

function clean() {
  return gulp
    .src(destFolder, { read: false, allowEmpty: true })
    .pipe(gulpClean());
}

function encrypt(content = '') {
  // The encryption here will be used to match the service-worker decryption
  return encodeURIComponent(content);
}

/**
 * The protect task will make a copy of contents while encrypting the
 * files with the extensions matching the given list
 */
function protect() {
  return gulp
    .src(srcFolder)
    .pipe(
      tap((file) => {
        if (encryptExtensions.includes(file.extname)) {
          file.contents = Buffer.from(encrypt(file.contents.toString()));
        }
      })
    )
    .pipe(gulp.dest(destFolder));
}

exports.protect = protect;
exports.default = gulp.series(clean, protect);
