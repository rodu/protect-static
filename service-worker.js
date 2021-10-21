async function decryptContent(response) {
  const decrypted = decodeURIComponent(await response.text());

  const { status, statusText, headers } = response;
  return new Response(decrypted, {
    status,
    statusText,
    headers,
  });
}

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (url.match(/\/app\/.+\.(j|cs)s$/)) {
    event.respondWith(fetch(url).then(decryptContent));
  }
});
