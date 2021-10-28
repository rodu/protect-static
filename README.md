# Protect Static

> Protect a single page app released at a public URL

This project provides a way to protect the sources of a single page app released on a publicly accessible website.

## Disclaimer

THE AUTHOR IS **NOT AN EXPERT** IN SUBJECTS OF SECURITY OR CRYPTOGRAPHY. USE AT YOUR OWN RISK.

## Overview

The solution uses the [SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) from the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) to implement End-to-End encryption and protect the source files of a static web app or single page app (SPA).

By design, the solution encrypts the content of HTML, CSS and JavaScript files.

## Prerequisites

Make sure you have Gulp installed. You can do so with:

`npm i -g gulp-cli`

Then run the usual:

`npm install`

## Generating a strong password

There are various tools to generate a strong password. An open source tool I use of is [PwGen](https://linux.die.net/man/1/pwgen).

**Install on MacOS:**
`brew install pwgen`

**Install on Ubuntu:**
`sudo apt install pwgen`

**Generate a strong password:**
`pwgen -sy 30 1`

Here I am generating a 30 characters length, secure password which includes symbols. Refers to the `pwgen` manual page for the various available options.

## How encryption takes place

The app we intend to protect should have its own build process (if any) and in any case provide a folder of sources ready to be released.

The solution protects the release sources by encrypting them using the [AES-GCM algorithm](https://isuruka.medium.com/selecting-the-best-aes-block-cipher-mode-aes-gcm-vs-aes-cbc-ee3ebae173c).

A Gulp task implements the algorithm and looks for the encryption password in a `PROTECT_STATIC_KEY` environment variable we should set before to runing `Gulp`.

To encrypt your app, **make sure to choose a strong password** and run the following command in the terminal:

`export PROTECT_STATIC_KEY yourChosenPassword gulp`

When the task runs, it copies the files to a release-ready `dist/app` folder, while encrypting the contents.

The final `dist` folder will also include a login page, alongside a service worker script (more on that later).

The Gulp task outputs a password hash that we need to **copy and keep somewhere** (not required to be safe). We need to add the password hash to the final URL of our app that we want to give to the people who need to see the app, like this:

`https://my-host-website/index.html#PASSWORD_HASH_HERE`

We can then release the dist folder at the hosting website of our choice, like (for example) GitHub pages.

## How the login works

When the user navigates to the public URL for the app, they must possess two things:

- the password required to decrypt the content
- a password verification hash (to be present in the URL)

The verification hash (md5) allows an initial validation of the password entered in the login input box, before proceeding any further.

When the user enters the password and clicks the Unlock button, the procedure checks that the hash present in the URL matches one generated from the password on the fly. If the two hashes match, we know we have a valid password.

Once the password validates, the (readable password) value is passed on to a service worker script that the login page has loaded in the background. The service worker acknowledges receiving the password, and the browser redirects to the `/app/index.html` which represents the entry point of the app we are protecting.

**Notice: The sources of the app are encrypted at rest (including the `index.html`).**

## How decryption takes place

When the user is redirected to `/app/index.html`, the service worker proceeds to intercept all the `GET` requests made to the `/app` folder for files with `.html`, `.css` and `.js` extension.

For each `GET` request matching this criteria, the service worker proceeds to decrypt the `Response` text on the fly, using the AES-GCM algorithm and the password initially provided.

When decryption succeeds, the service worker creates a new `Response` object containing the decrypted text for the content of the file and returns the `Response` to the browser.

With the service worker, the decryption process happens entirely on the client-side and the browser is able to render the protected content as if it was never encrypted!

If someone would try to reach or scrap the protected app contents directly (say at /app/main.js), they would only see _gibberish_ from encrypted file contents.

## Things to notice

The Web Crypto API ([SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)) and [Sevice Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) require (and only work) in a trusted environemnt, also known as [Secure Context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).

**The app must be seved under a valid HTTPS connection or from the localhost environment, for these APIs to work.**

## Resources

- [This awesome Gist and contributor comments](https://gist.github.com/chrisveness/43bcda93af9f646d083fad678071b90a)

## License

MIT License

Copyright (c) 2021 rodu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
