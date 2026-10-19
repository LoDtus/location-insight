(function () {
  const SESSION = "li-session";
  const HISTORY = "li-history";
  const USED = "li-used";
  const VALUATION = "li-valuation";
  const SAVED = "li-saved";
  const LISTINGS = "li-listings";
  const DAILY = 10;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function root() {
    return document.body.dataset.root || "";
  }

  function session() {
    return read(SESSION, null);
  }

  function signIn(user) {
    write(SESSION, user);
  }

  function signOut() {
    localStorage.removeItem(SESSION);
  }

  function requireSession() {
    if (session()) return session();
    const next = "app/" + location.pathname.split("/").pop() + location.search;
    location.href = root() + "dang-nhap.html?next=" + encodeURIComponent(next);
    return null;
  }

  function safeNext(value) {
    if (!value) return root() + "app/tra-cuu.html";
    if (!/^(app\/[a-z0-9-]+\.html|dang-tin\.html)(\?[A-Za-z0-9=&%._-]*)?$/.test(value)) {
      return root() + "app/tra-cuu.html";
    }
    return root() + value;
  }

  function history() {
    return read(HISTORY, []);
  }

  function remember(id) {
    const items = history().filter((item) => item.id !== id);
    items.unshift({ id, at: new Date().toISOString() });
    write(HISTORY, items.slice(0, 12));
  }

  function usedCount() {
    const today = new Date().toISOString().slice(0, 10);
    const bag = read(USED, { day: today, count: 0 });
    if (bag.day !== today) return 0;
    return bag.count;
  }

  function remaining() {
    return Math.max(0, DAILY - usedCount());
  }

  function consume() {
    const today = new Date().toISOString().slice(0, 10);
    const bag = read(USED, { day: today, count: 0 });
    const count = bag.day === today ? bag.count : 0;
    if (count >= DAILY) return false;
    write(USED, { day: today, count: count + 1 });
    return true;
  }

  function saveValuation(id, input) {
    const all = read(VALUATION, {});
    all[id] = input;
    write(VALUATION, all);
  }

  function loadValuation(id) {
    return read(VALUATION, {})[id] || null;
  }

  function savedPlaces() {
    return read(SAVED, []);
  }

  function putSaved(item) {
    const items = savedPlaces().filter((row) => row.id !== item.id);
    items.unshift(item);
    write(SAVED, items.slice(0, 40));
    return items.length <= 40;
  }

  function removeSaved(id) {
    write(SAVED, savedPlaces().filter((row) => row.id !== id));
  }

  function listings() {
    return read(LISTINGS, []);
  }

  function putListing(item) {
    const items = listings();
    items.unshift(item);
    write(LISTINGS, items.slice(0, 20));
  }

  function removeListing(id) {
    write(LISTINGS, listings().filter((row) => row.id !== id));
  }

  function toast(message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.setAttribute("role", "status");
    node.textContent = message;
    document.body.appendChild(node);
    window.setTimeout(() => node.remove(), 3200);
  }

  function asset(path) {
    return root() + path;
  }

  function icons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function bindNav() {
    const button = document.querySelector("[data-nav-toggle]");
    const nav = document.querySelector("[data-nav]");
    if (!button || !nav) return;
    button.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("is-open");
        button.setAttribute("aria-expanded", "false");
      });
    });
  }

  function paintAuthLinks() {
    const user = session();
    document.querySelectorAll("[data-auth='cta']").forEach((link) => {
      if (user) link.setAttribute("href", root() + "app/ghim.html");
    });
    document.querySelectorAll("[data-auth='login']").forEach((link) => {
      if (!user) return;
      link.setAttribute("href", root() + "app/tai-khoan.html");
      link.textContent = "Tài khoản";
    });
    const chip = document.querySelector("[data-user]");
    if (chip) chip.textContent = user ? user.email : "";
  }

  window.LIStore = {
    root,
    session,
    signIn,
    signOut,
    requireSession,
    safeNext,
    history,
    remember,
    remaining,
    consume,
    saveValuation,
    loadValuation,
    savedPlaces,
    putSaved,
    removeSaved,
    listings,
    putListing,
    removeListing,
    toast,
    asset,
    icons,
    bindNav,
    paintAuthLinks,
    DAILY,
  };
})();
