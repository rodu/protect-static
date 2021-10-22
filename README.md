# Protect Static

> Protect a single page app at a public url

This project is a functioning _proof-of-concept_ providing a way to protect the sources of a single page app released on a publicly accessible website.

**\*\* DISCLAIMER \*\***
PLEASE NOTE, I AM NOT AN EXPERT OF SECURITY OR CRYPTOGRAPHY. USE AT YOUR OWN RISK

The solution uses the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) to implement End-to-End encryption and protect the source files of a static web app. By design, the solution encrypts the content of HTML, CSS and JavaScript files.

Sources are encrypted using the AES-GCM algorithm through a Gulp task that copies the files manipulates (encrypting) their content. A login page is then added to the final assets collection ready for release.

## How the login works

When the user navigates to the public URL of the app, they must possess the password and a verification hash (to be given in the URL) that allows a first verification of the password, before proceeding any further.

When the user enters the password and clicks the Unlock button, the procedure creates an hash of the password to verify if the URL hash matches. If the two hashes match, the user has entered a valid password.

Once the password validates, this is passed on to a service worker script, and the browser is redirected to the `/app/index.html` which should be the entry point of the app we are protecting.

**Notice: The sources of the app are encrypted at rest (including the `index.html`).**

## How decryption takes place

When the user is redirected to `/app/index.html`, the service worker (registered/activated at the login page) proceeds to intercept all the `GET` requests made to the `/app` folder for files with `.html`, `.css` and `.js` extension.

For each `GET` request matching this criteria, the service worker proceeds to decrypt the contents on the fly, using the AES-GCM algorithm and the password initially entered.

When decryption succeeds, the service worker creates a new `Response` object on the fly, containing the clear text for the content and returns that to the browser.

The browser can now render the protected app as if it was never encrypted!

If someone would try to reach the protected app directly, they would only see _gibberish_ from encrypted file contents.
