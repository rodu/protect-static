# ProtectStatic

> Protect a single page app released at a public URL

This project provides a way to protect the sources of a single page app released on a publicly accessible website.

## Disclaimer

THE AUTHOR IS **NOT AN EXPERT** IN SUBJECTS OF SECURITY OR CRYPTOGRAPHY. USE AT YOUR OWN RISK.

## Overview

When working on a project, we may need to give access to a restricted number of users or a customer. With **ProtectStatic** we can release a single page app (or a static website) to a public URL, while ensuring our sources remain secure from unintended audience.

The solution uses the [SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) from the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) to implement End-to-End encryption and protect the source files our app. By design, the solution encrypts the content of HTML, CSS and JavaScript files and can handle any textual file content.

## Install

In your project (the one you want to publish and protect) run:

The package is not released to NPM registry at this time and you can install directly from GitHub:

`npm install --save-dev git+https://github.com/rodu/protect-static.git`

**Note:** During the install, you may notice lots of text being printed out. That's output from the `node-webcrypto-ossl` and it's perfectly normal.

## Configuration Options

Before we can encrypt out app sources, we need to indicate some configuration options to identify the folder containing sources, what sources to encrypt and where to put the output.

To do that, you can create a `.protectstaticrc` file in your project and enter code like shown below:

```json
{
  "appDistFolder": "app",
  "protectedDistFolder": "dist-protected",
  "encryptExtensions": ["html", "css", "js"]
}
```

| Parameter           | Description                                                  | Default                 |
| ------------------- | ------------------------------------------------------------ | ----------------------- |
| appDistFolder       | Folder containing the assets you want to publish and protect | `app`                   |
| protectedDistFolder | Output folder where the login and protected sources will be  | `dist-protected`        |
| encryptExtensions   | Array of file extensions you want to be encrypted            | `['html', 'css', 'js']` |

## How encryption takes place

The web app we want to protect should have its own build process (if any) and in any case provide a folder of sources ready to be released (`appDistFolder`).

The solution protects the release sources by encrypting them using the [AES-GCM algorithm](https://isuruka.medium.com/selecting-the-best-aes-block-cipher-mode-aes-gcm-vs-aes-cbc-ee3ebae173c).

The script looks for the encryption password in a `PROTECT_STATIC_KEY` environment variable. If a value is not set, **the script will automatically generate a strong password** and show it later.

The script copies the app source files to a release-ready folder (`protectedDistFolder/appDistFolder`), while encrypting the contents. The output folder will also include a login page, alongside a service worker script (more on that later).

After the encryption/copy, the script outputs the password that was used and a _password verification hash_ that we need to add to the URL of our app, like this:

`https://my-host-website/#PASSWORD_HASH_HERE`

We can then release the output folder at the hosting website, for example GitHub pages.

## How the login works

When the user navigates to the public URL for the app, they must possess two things:

- the password required to decrypt the content
- the password verification hash (to be present in the URL)

The verification hash (md5) allows an initial validation of the password entered in the login input box, before proceeding any further.

When the user enters the password and clicks the Unlock button, the procedure checks that the hash present in the URL matches with a hash of the password we entered. If the two hashes match, we know we have a valid password.

Once the password validates, the (readable password) value is passed on to a service worker script that the login page has loaded in the background. The service worker acknowledges receiving the password, and the browser redirects to the `/[appDistFolder]/index.html` which represents the entry point of the app we are protecting.

**Notice: The sources of the app are encrypted at rest (including the `index.html`).**

## How decryption takes place

When the user is redirected to `/[appDistFolder]/index.html`, the service worker proceeds to intercept all the `GET` requests made to the `/[appDistFolder]` folder for files with `.html`, `.css` and `.js` extension.

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
