# ProtectStatic

> Protect a static website released at a public URL

<img src="https://raw.githubusercontent.com/rodu/protect-static/main/protect-static.png" alt="ProtectStatic diagram" style="display: block; margin: 0 auto; border: 0; max-width:910px; width: 100%;">

---

- [Overview](#overview)
- [Install](#install)
- [Configuration and usage](#configuration-and-usage)
- [How encryption takes place](#how-encryption-takes-place)
- [How the login works](#how-the-login-works)
- [How decryption takes place](#how-decryption-takes-place)
- [Ensuring resources load correctly](#ensuring-resources-load-correctly)
- [Things to notice](#things-to-notice)
- [Resources](#resources)
- [License](#license)

## Overview

This project provides a way to protect the sources of a static web site or single page app released on a publicly accessible URL.

When working on a project, we may need to give access to a restricted number of users or a customer. With **ProtectStatic** we can release a single page app (or a static website) to a public URL, while ensuring our sources remain secure from unintended audience.

The solution uses the [SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) from the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) to implement End-to-End encryption and protect the source files of our app. By design, the solution encrypts the content of HTML, CSS and JavaScript files and can handle any textual file content.

### Demo

You can see a [demo](https://rodu.github.io/protect-static-demo/#47b7bfb65fa83ac9a71dcb0f6296bb6e) of a basic Gatsby app released on GitHub Pages and protected with ProtectStatic.

**Unlock key:** `Passw0rd!`

Here's the [GitHub repository](https://github.com/rodu/protect-static-demo) for the demo if you want to take a look.

## Install

In your project (the one you want to protect) run:

`npm install --save-dev protect-static`

## Configuration and usage

Configuration options allow to identify the folder containing our app sources, what sources to encrypt and where to generate the output.

| Parameter         | Description                                        | Default                  |
| ----------------- | -------------------------------------------------- | ------------------------ |
| sourceFolder      | Folder containing assets to protect                | `./app`                  |
| destFolder        | Folder where the protected assets will be          | `./app-protected`        |
| encryptExtensions | Comma separated list of file extensions to encrypt | `html,css,js`            |
| skipPrompt        | Assumes yes answer for any prompt                  | `false`                  |
| hostUrl           | Helper to generate protected app URL in output     | `http://localhost:8080/` |

**Notice:** An rc file `.protectstaticrc` (if present) can override these defaults

### Specifying an rc file for confguration

You can use a `.protectstaticrc` file in your project to specify the default configuration that should be used.

Any of the parameters from the table above can be declared to override the defaults.

```json
{
  "sourceFolder": "app",
  "destFolder": "app-protected",
  "encryptExtensions": "html,css,js"
}
```

### Command line options

Explicit command line options take precendence over the the rc file values (if present)

```text
Options:
  -V, --version                     output the version number
  -s, --sourceFolder <path>         folder containing assets to protect
  -d, --destFolder <path>           folder where the protected assets will be
  -e, --encryptExtensions <string>  comma separated list of file extensions to encrypt
  -y, --skipPrompt                  assumes yes answer for any prompt
  -u, --hostUrl <url>               helper to generate protected app URL
  -h, --help                        display help for command
```

### Usage

You can use npx directy, in combination with command line arguments or the `.protectstaticrc` file:

`npx protect-static --encryptExtensions=css,js`

Or define an npm script like this:

```json
{
  "scripts": {
    ...
    "protect-static": "protect-static"
    ...
  }
}
```

And run it with: `npm run protect-static`

## How encryption takes place

The solution protects the release sources by encrypting them using the [AES-GCM algorithm](https://isuruka.medium.com/selecting-the-best-aes-block-cipher-mode-aes-gcm-vs-aes-cbc-ee3ebae173c).

The script looks for the encryption password in a `PROTECT_STATIC_KEY` environment variable. If a value is not set, **the script will automatically generate a strong password** and show it later.

The script copies the app source files to a release-ready folder (`destFolder`), while encrypting the contents. The output folder will also include a login page, alongside a service worker script used for decrypting contents on the fly (more on that later).

After the encryption/copy, the script outputs the password that was used and a _password verification hash_ that we need to add to the URL of our app, like this:

`https://my-host-website/#PASSWORD_HASH_HERE`

We can then release the output folder at the hosting website, for example GitHub pages.

## How the login works

When the user navigates to the public URL for the app, they must possess two things:

- the password required to decrypt the content
- the password verification hash (to be present in the URL)

The verification hash (md5) allows an initial validation of the password entered in the login input box, before proceeding any further.

Once the password validates, the (readable password) value is passed on to a service worker script that the login page has loaded in the background. The service worker acknowledges receiving the password, and the browser redirects to the `/[sourceFolder]/index.html` which represents the entry point of the app we are protecting.

## How decryption takes place

When the user is redirected to `/[sourceFolder]/index.html`, the service worker proceeds to intercept all the `GET` requests made to the `/[sourceFolder]` folder for files matching any of the `encryptExtensions` entries.

For each `GET` request matching this criteria, the service worker proceeds to decrypt the `Response` text on the fly, using the AES-GCM algorithm and the password initially provided.

When decryption succeeds, the service worker creates a new `Response` object containing the decrypted text for the content of the file and returns the `Response` to the browser.

With the service worker, the decryption process happens transparently and entirely on the client-side. The browser is able to render the protected content as if it was never encrypted!

If someone would try to reach (or scrap) the protected app contents directly, they would only see _gibberish_ from encrypted file contents.

## Ensuring resources load correctly

When running the protected app **you may get 404 Not Found** erorrs for some resources. In that case, you need to fix something with your URLs.

As you may have noticed, after running the `protect-static` the base of your app becomes the login page. Your app contents are generated within a subfolder of that, matching the original `sourceFolder` parameter.

An example output could be as follows:

- `https://my-secure-host/index.html` (the login page)
- `https://my-secure-host/app/index.html` (your app entry point under `/app`)

For your app to be able to load resources, such as external CSS, images, or JavaScript sources, you must ensure that absolute URLs are configured correctly, when present. In some cases, the `BASE_URL` (or `PUBLIC_URL`) env variables can be configured (in this example to be `/app/`) when running the build (if you have one).

Having your app pointing at a resource such as `/scripts/main.js` **will result in a 404 Not Found error**. That's because the correct url after protect-static may have become something like `/app/scripts/main.js` depending on your configuration.

To that extent, your handy npm command may be changed to something like:

```json
{
  "protect-static": "PUBLIC_URL=/app/ npm run build && protect-static"
}
```

Where the example `app` value here should match your `sourceFolder` value.

In general, non-absolute URLs (like in `scripts/main.js` with no leading `/`) should work out of the box.

## Things to notice

The Web Crypto API ([SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)) and [Sevice Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) require (and only work) in a trusted environemnt, also known as [Secure Context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).

**The app must be seved under a valid HTTPS connection or from the localhost environment**, for these APIs to work.

## Resources

- [This awesome Gist and contributor comments](https://gist.github.com/chrisveness/43bcda93af9f646d083fad678071b90a)

## License

MIT License

Copyright (c) 2021 Robbie Schioppa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
