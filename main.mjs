const formUnlock = document.getElementById('form-unlock');

formUnlock.addEventListener('submit', (event) => {
  event.preventDefault();

  window.location.pathname = '/dist/index.html';
});
