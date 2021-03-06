# ProtectStatic

## NOTICE: This package was a proof of concept and is now deprecated

---

- [Overview](#overview)
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

The solution uses the [SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) from the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) to implement End-to-End encryption and protect the source files of our app. By design, the solution encrypts the content of HTML, CSS and JavaScript files and can handle any **textual file content**.

<small>_Encrypting images (or other binaries) is not supported._</small>

## Configuration and usage

Configuration options allow to identify the folder containing our app sources, what sources to encrypt and where to generate the output.

| Parameter         | Description                                        | Default                  |
| ----------------- | -------------------------------------------------- | ------------------------ |
| sourceFolder      | Folder containing assets to protect                | `./app`                  |
| destFolder        | Folder where the protected assets will be          | `./app-protected`        |
| encryptExtensions | Comma separated list of file extensions to encrypt | `html,css,js`            |
| indexFile         | Index file used for your app or website            | `index.html`             |
| skipPrompt        | Assumes yes answer for any prompt                  | `false`                  |
| hostUrl           | Helper to generate protected app URL in output     | `http://localhost:8080/` |
| quiet             | Print only relevant messages to console            | `false`                  |

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
  -i, --indexFile <string>          index file used for your app or website
  -y, --skipPrompt                  assumes yes answer for any prompt
  -u, --hostUrl <url>               helper to generate protected app URL
  -q, --quiet                       print only relevant messages to console
  -h, --help                        display help for command
```

### Specifying your password

You can specify a password by setting a `PROTECT_STATIC_KEY` environment variable.

The script looks for the encryption password in the environment variable first; if a value is not set, **the script will automatically generate a strong password** for you and show it later.

## How encryption takes place

The solution protects the release sources by encrypting them using the [AES-GCM algorithm](https://isuruka.medium.com/selecting-the-best-aes-block-cipher-mode-aes-gcm-vs-aes-cbc-ee3ebae173c).

The script copies the app source files to a release-ready folder (`destFolder`), while encrypting the contents of those files matching the extension from the `encryptExtensions` list. The output folder will also include a login page, alongside a service worker script used for decrypting contents on the fly (more on that later).

After the encryption/copy, the script outputs the password that was used and a _password verification hash_ that we need to add to the URL of our app, like this:

`https://my-host-website/#PASSWORD_HASH_HERE`

We can then release the output folder at the hosting website, for example GitHub pages.

## How the login works

When the user navigates to the public URL for the app, they must possess two things:

- the password required to decrypt the content
- the password verification hash (to be present in the URL)

The verification hash (md5) allows an initial validation of the password entered in the login input box, before proceeding any further.

Once the password validates, the (readable password) value is passed on to a service worker script that the login page has loaded in the background. The service worker acknowledges receiving the password, and the browser redirects to the `/[sourceFolder]/[indexFile]` which represents the entry point of the app we are protecting.

## How decryption takes place

When the user is redirected to `/[sourceFolder]/[indexFile]`, the service worker proceeds to intercept all the `GET` requests made to the `/[sourceFolder]` folder for files matching any of the `encryptExtensions` entries.

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

Where the example `app` value here should match your `sourceFolder` value.

In general, non-absolute URLs (like in `scripts/main.js` with no leading `/`) should work out of the box.

## Things to notice

The Web Crypto API ([SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)) and [Sevice Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) require (and only work) in a trusted environemnt, also known as [Secure Context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).

**The app must be seved under a valid HTTPS connection or from the localhost environment**, for these APIs to work.

## Resources

- [This awesome Gist and contributor comments](https://gist.github.com/chrisveness/43bcda93af9f646d083fad678071b90a)

## License

This project is released under the MIT license, which can be found in the [LICENSE](https://raw.githubusercontent.com/rodu/protect-static/main/LICENSE) file.
