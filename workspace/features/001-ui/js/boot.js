document.addEventListener("DOMContentLoaded", () => {
  const store = window.LIStore;
  if (!store) return;
  store.bindNav();
  store.paintAuthLinks();
  const page = document.body.dataset.page;
  const start = window.LIPages && window.LIPages[page];
  if (start) start();
  store.icons();
});
