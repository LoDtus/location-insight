(function () {
  const data = () => window.LIData;
  const store = () => window.LIStore;

  function params() {
    return new URLSearchParams(location.search);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function fieldError(input, message) {
    const holder = input.closest(".field");
    const existing = holder.querySelector(".field-error");
    if (existing) existing.remove();
    input.setAttribute("aria-invalid", message ? "true" : "false");
    if (!message) return;
    const note = el("p", "field-error", message);
    note.id = input.id + "-error";
    input.setAttribute("aria-describedby", note.id);
    holder.appendChild(note);
  }

  function bindPasswordToggles(scope) {
    scope.querySelectorAll("[data-toggle-password]").forEach((button) => {
      const input = document.getElementById(button.dataset.togglePassword);
      button.addEventListener("click", () => {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.setAttribute("aria-label", show ? "Ẩn mật khẩu" : "Hiện mật khẩu");
        button.innerHTML = show ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
        store().icons();
      });
    });
  }

  function loginPage() {
    const form = document.getElementById("form-login");
    const query = params();
    if (query.get("reset") === "1") {
      store().toast("Mật khẩu đã được đặt lại trong bản mock.");
    }
    bindPasswordToggles(form);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = form.email.value.trim();
      const password = form.password.value;
      let ok = true;
      if (!email.includes("@")) {
        fieldError(form.email, "Nhập email có dấu @.");
        ok = false;
      } else fieldError(form.email, "");
      if (password.length < 8) {
        fieldError(form.password, "Mật khẩu cần ít nhất 8 ký tự.");
        ok = false;
      } else fieldError(form.password, "");
      if (!ok) {
        form.querySelector("[aria-invalid='true']").focus();
        return;
      }
      store().signIn({ name: email.split("@")[0], email });
      location.href = store().safeNext(query.get("next"));
    });
  }

  function registerPage() {
    const form = document.getElementById("form-register");
    bindPasswordToggles(form);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const password = form.password.value;
      const again = form.again.value;
      let ok = true;
      if (name.length < 2) {
        fieldError(form.name, "Nhập tên để hiển thị trên tài khoản.");
        ok = false;
      } else fieldError(form.name, "");
      if (!email.includes("@")) {
        fieldError(form.email, "Nhập email có dấu @.");
        ok = false;
      } else fieldError(form.email, "");
      if (password.length < 8) {
        fieldError(form.password, "Dùng ít nhất 8 ký tự.");
        ok = false;
      } else fieldError(form.password, "");
      if (again !== password) {
        fieldError(form.again, "Mật khẩu nhập lại chưa khớp.");
        ok = false;
      } else fieldError(form.again, "");
      if (!ok) {
        form.querySelector("[aria-invalid='true']").focus();
        return;
      }
      store().signIn({ name, email });
      location.href = store().root() + "app/ghim.html";
    });
  }

  function forgotPage() {
    const form = document.getElementById("form-forgot");
    const done = document.getElementById("forgot-done");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = form.email.value.trim();
      if (!email.includes("@")) {
        fieldError(form.email, "Nhập email có dấu @.");
        form.email.focus();
        return;
      }
      fieldError(form.email, "");
      form.hidden = true;
      done.hidden = false;
      done.querySelector("[data-email]").textContent = email;
    });
  }

  function resetPage() {
    const form = document.getElementById("form-reset");
    bindPasswordToggles(form);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const password = form.password.value;
      const again = form.again.value;
      let ok = true;
      if (password.length < 8) {
        fieldError(form.password, "Dùng ít nhất 8 ký tự.");
        ok = false;
      } else fieldError(form.password, "");
      if (again !== password) {
        fieldError(form.again, "Mật khẩu nhập lại chưa khớp.");
        ok = false;
      } else fieldError(form.again, "");
      if (!ok) {
        form.querySelector("[aria-invalid='true']").focus();
        return;
      }
      location.href = store().root() + "dang-nhap.html?reset=1";
    });
  }

  function ghimPage() {
    if (!store().requireSession()) return;
    const mapNode = document.getElementById("map");
    const input = document.getElementById("dia-chi");
    const list = document.getElementById("goi-y");
    const status = document.getElementById("trang-thai-ghim");
    const go = document.getElementById("xem-bao-cao");
    const quota = document.getElementById("han-muc");
    let picked = null;
    let marker = null;
    let map = null;

    function paintQuota() {
      const left = store().remaining();
      quota.textContent = "Còn " + left + " / " + store().DAILY + " lượt phân tích hôm nay. Báo cáo mẫu không tính.";
      if (left === 0) {
        go.disabled = true;
        status.textContent = "Hết lượt hôm nay. Xem lại báo cáo đã lưu, hoặc đợi sang ngày mới trong bản mock.";
      }
    }

    function renderSuggestions(items) {
      list.replaceChildren();
      if (!items.length) {
        const item = el("li");
        const button = el("button", "", "Không thấy địa chỉ mẫu khớp. Thử «Văn Miếu», «Hồ Gươm» hoặc «Nội Bài».");
        button.type = "button";
        button.disabled = true;
        item.appendChild(button);
        list.appendChild(item);
        return;
      }
      items.forEach((place) => {
        const item = el("li");
        const button = document.createElement("button");
        button.type = "button";
        button.innerHTML = "<strong></strong><br><span class='meta'></span>";
        button.querySelector("strong").textContent = place.address;
        button.querySelector("span").textContent = place.geocodeNote;
        button.addEventListener("click", () => choose(place));
        item.appendChild(button);
        list.appendChild(item);
      });
    }

    function choose(place, lat, lng) {
      picked = {
        id: place.id,
        lat: lat ?? place.lat,
        lng: lng ?? place.lng,
        address: place.address,
      };
      input.value = place.address;
      const near = data().nearest(picked.lat, picked.lng);
      status.textContent =
        "Ghim tại " +
        picked.lat.toFixed(5) +
        ", " +
        picked.lng.toFixed(5) +
        ". Bản mock sẽ mở báo cáo mẫu gần nhất: " +
        near.place.title +
        ".";
      go.disabled = store().remaining() === 0;
      go.dataset.id = near.place.id;
      if (marker) {
        marker.setLatLng([picked.lat, picked.lng]);
        map.panTo([picked.lat, picked.lng]);
      }
    }

    input.addEventListener("input", () => {
      const query = input.value.trim();
      if (foldQueryIsError(query)) {
        list.replaceChildren();
        status.textContent = "Ô tìm địa chỉ mẫu không trả được điểm này.";
        go.disabled = true;
        return;
      }
      renderSuggestions(data().searchPlaces(query));
      go.disabled = true;
      picked = null;
    });

    document.getElementById("thu-loi").addEventListener("click", (event) => {
      event.preventDefault();
      const q = input.value.trim() || "18 ngõ Văn Miếu";
      location.href = "loi.html?q=" + encodeURIComponent(q);
    });

    go.addEventListener("click", () => {
      if (!picked || store().remaining() === 0) return;
      const id = go.dataset.id || picked.id;
      location.href = "dang-tai.html?id=" + encodeURIComponent(id);
    });

    function applyQuery() {
      const preset = params().get("q");
      if (!preset) return;
      input.value = preset;
      if (foldQueryIsError(preset)) {
        list.replaceChildren();
        status.textContent = "Ô tìm địa chỉ mẫu không trả được điểm này.";
        go.disabled = true;
        return;
      }
      const matches = data().searchPlaces(preset);
      if (!matches.length) {
        renderSuggestions(data().places);
        status.textContent = "Chưa khớp địa chỉ mẫu cho «" + preset + "». Chọn một điểm bên dưới hoặc kéo ghim.";
        return;
      }
      renderSuggestions(matches);
      choose(matches[0]);
    }

    paintQuota();
    renderSuggestions(data().places);
    if (!window.L) {
      status.textContent = "Không tải được bản đồ. Vẫn chọn một địa chỉ mẫu bên dưới.";
      applyQuery();
      return;
    }
    const start = data().places[0];
    map = L.map(mapNode, { scrollWheelZoom: true }).setView([start.lat, start.lng], 15);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const icon = L.icon({
      iconUrl: store().asset("js/vendor/images/marker-icon.png"),
      iconRetinaUrl: store().asset("js/vendor/images/marker-icon-2x.png"),
      shadowUrl: store().asset("js/vendor/images/marker-shadow.png"),
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });
    marker = L.marker([start.lat, start.lng], { draggable: true, icon }).addTo(map);
    marker.on("dragend", () => {
      const point = marker.getLatLng();
      const near = data().nearest(point.lat, point.lng);
      choose(near.place, point.lat, point.lng);
    });
    window.setTimeout(() => map.invalidateSize(), 150);
    applyQuery();
  }

  function landingPage() {
    const form = document.getElementById("form-dia-chi");
    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const address = form.q.value.trim();
        const target = address ? "app/ghim.html?q=" + encodeURIComponent(address) : "app/ghim.html";
        if (store().session()) {
          location.href = target;
          return;
        }
        location.href = "dang-nhap.html?next=" + encodeURIComponent(target);
      });
    }

    bindLookup();
    bindStories();

    const confirm = document.getElementById("xac-nhan-goi");
    document.querySelectorAll("[data-plan]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!confirm) return;
        confirm.hidden = false;
        confirm.textContent =
          "Bản mock chưa thu tiền. Bạn chọn gói " +
          button.dataset.plan +
          ", trả theo " +
          button.dataset.cycle +
          ", " +
          button.dataset.amount +
          ".";
        confirm.focus();
      });
    });

    const ask = document.getElementById("form-hoi");
    if (!ask) return;
    ask.addEventListener("submit", (event) => {
      event.preventDefault();
      const field = ask.querySelector("#cau-hoi");
      const question = field.value.trim();
      if (!question) {
        fieldError(field, "Nhập câu hỏi trước khi xem trả lời.");
        field.focus();
        return;
      }
      fieldError(field, "");
      const box = document.getElementById("tra-loi");
      document.getElementById("noi-dung-tra-loi").textContent = answerFor(question);
      box.hidden = false;
      box.focus();
    });
  }

  function bindLookup() {
    const panel = document.getElementById("chi-tiet-diem");
    const status = document.getElementById("tra-trang-thai");
    const search = document.getElementById("tra-dia-chi");
    if (!panel || !status) return;

    const radiusCopy = {
      500: "500 m: tiện ích đi bộ.",
      2000: "2 km: bệnh viện và ga metro.",
      3000: "3 km: không khí chỉ được gán khi trạm còn trong bán kính này.",
    };
    let radius = 500;
    let active = null;
    let map = null;
    let circle = null;
    let stray = null;
    const markers = {};

    function formatMeters(meters) {
      if (meters < 1000) return Math.round(meters) + " m";
      const km = meters / 1000;
      return km.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " km";
    }

    function list(items) {
      const ul = el("ul", "plain-list");
      items.forEach((item) => ul.append(el("li", null, item)));
      return ul;
    }

    function showPlace(place, note) {
      active = place;
      panel.replaceChildren(el("h3", null, place.title), el("p", null, place.address));
      if (note) panel.append(el("p", "fine", note));
      panel.append(el("h4", null, "Điểm mạnh"), list(place.strengths));
      panel.append(el("h4", null, "Điểm yếu hoặc chưa kết luận"), list(place.gaps));
      const link = el("a", null, "Xem báo cáo đầy đủ");
      link.href = "app/bao-cao.html?id=" + encodeURIComponent(place.id) + "&mau=1";
      panel.append(link);
      document.querySelectorAll("[data-place]").forEach((button) => {
        button.setAttribute("aria-pressed", button.dataset.place === place.id ? "true" : "false");
      });
      status.textContent = place.title + ". " + radiusCopy[radius];
    }

    function showEmpty(message) {
      active = null;
      panel.replaceChildren(el("h3", null, "Chưa có số đo"), el("p", null, message));
      document.querySelectorAll("[data-place]").forEach((button) => button.setAttribute("aria-pressed", "false"));
      status.textContent = message;
    }

    function popupHtml(place, note) {
      const items = (lines) => lines.map((line) => "<li>" + escapeHtml(line) + "</li>").join("");
      return (
        '<div class="map-popup"><strong>' +
        escapeHtml(place.title) +
        "</strong><p>" +
        escapeHtml(place.coverage) +
        " trong 500 m. " +
        escapeHtml(place.coverageHint) +
        ".</p>" +
        (note ? "<p>" + escapeHtml(note) + "</p>" : "") +
        "<p><strong>Điểm mạnh</strong></p><ul>" +
        items(place.strengths) +
        "</ul><p><strong>Điểm yếu hoặc chưa kết luận</strong></p><ul>" +
        items(place.gaps) +
        "</ul></div>"
      );
    }

    function drawCircle(place) {
      if (!map) return;
      if (circle) circle.remove();
      circle = L.circle([place.lat, place.lng], {
        radius: radius,
        color: "#1b4332",
        weight: 2,
        fillColor: "#1b4332",
        fillOpacity: 0.08,
      }).addTo(map);
      circle.bindTooltip(radiusCopy[radius], { sticky: true, className: "lookup-tip" });
    }

    function moveTo(place) {
      if (!map) return;
      const zoom = radius >= 3000 ? 12 : radius >= 2000 ? 13 : 15;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) map.setView([place.lat, place.lng], zoom);
      else map.flyTo([place.lat, place.lng], zoom);
    }

    function closePopups() {
      if (map) map.closePopup();
      Object.keys(markers).forEach((id) => markers[id].closePopup());
    }

    function select(place, meters) {
      closePopups();
      if (stray) {
        stray.remove();
        stray = null;
      }
      const note =
        meters > 80
          ? "Bạn chấm cách điểm đã đo khoảng " + formatMeters(meters) + ". Số bên dưới là của " + place.title + "."
          : "";
      showPlace(place, note);
      if (!map || !markers[place.id]) return;
      drawCircle(place);
      markers[place.id].bindPopup(popupHtml(place, note), { maxWidth: 320, minWidth: 240, maxHeight: 280, autoPan: true, keepInView: true }).openPopup();
      moveTo(place);
    }

    function miss(latlng) {
      closePopups();
      active = null;
      if (circle) {
        circle.remove();
        circle = null;
      }
      document.querySelectorAll("[data-place]").forEach((button) => button.setAttribute("aria-pressed", "false"));
      const message = "Điểm vừa chấm chưa có số đo. Chọn Ngõ Văn Miếu, Hồ Gươm hoặc Nội Bài. Trang không điền điểm mạnh hay điểm yếu khi chưa có số.";
      showEmpty(message);
      if (!map) return;
      if (stray) stray.remove();
      stray = L.marker(latlng, { icon: markerIcon() }).addTo(map);
      stray.bindPopup("<div class=\"map-popup\"><strong>Chưa có số đo</strong><p>" + escapeHtml(message) + "</p></div>", { maxWidth: 280, maxHeight: 220, autoPan: true, keepInView: true }).openPopup();
    }

    function markerIcon() {
      return L.icon({
        iconUrl: store().asset("js/vendor/images/marker-icon.png"),
        iconRetinaUrl: store().asset("js/vendor/images/marker-icon-2x.png"),
        shadowUrl: store().asset("js/vendor/images/marker-shadow.png"),
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -32],
        tooltipAnchor: [0, -32],
        shadowSize: [41, 41],
      });
    }

    document.querySelectorAll("[data-place]").forEach((button) => {
      button.addEventListener("click", () => {
        const place = data().getPlace(button.dataset.place);
        if (place) select(place, 0);
      });
    });

    document.querySelectorAll("[data-radius]").forEach((button) => {
      button.addEventListener("click", () => {
        radius = Number(button.dataset.radius);
        document.querySelectorAll("[data-radius]").forEach((item) => {
          item.setAttribute("aria-pressed", item === button ? "true" : "false");
        });
        if (active) {
          drawCircle(active);
          moveTo(active);
          status.textContent = active.title + ". " + radiusCopy[radius];
        } else {
          status.textContent = radiusCopy[radius] + " Vòng tròn hiện khi bạn đã chọn một điểm.";
        }
      });
    });

    function runSearch() {
      if (!search) return;
      const query = search.value.trim();
      if (!query) return;
      const matches = data().searchPlaces(query);
      if (!matches.length) {
        status.textContent = "Chưa có điểm đã đo khớp «" + query + "».";
        return;
      }
      select(matches[0], 0);
      if (matches.length > 1) {
        status.textContent = "Khớp " + matches.length + " điểm. Đang mở " + matches[0].title + ". Chọn nút điểm nếu muốn điểm khác.";
      }
    }

    if (search) {
      search.addEventListener("change", runSearch);
      search.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        runSearch();
      });
    }

    const mapNode = document.getElementById("ban-do-tra");
    if (!mapNode || !window.L) {
      status.textContent = "Không tải được bản đồ. Vẫn chọn một điểm đã đo ở phía trên để đọc điểm mạnh và điểm yếu.";
      return;
    }

    const places = data().places;
    map = L.map(mapNode, { scrollWheelZoom: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const icon = markerIcon();
    places.forEach((place) => {
      const marker = L.marker([place.lat, place.lng], { icon }).addTo(map);
      marker.bindTooltip(place.title + " · " + place.coverage + " trong 500 m", { direction: "top" });
      marker.on("click", () => select(place, 0));
      markers[place.id] = marker;
    });
    map.on("click", (event) => {
      const near = data().nearest(event.latlng.lat, event.latlng.lng);
      if (near.meters <= 600) select(near.place, near.meters);
      else miss(event.latlng);
    });
    map.fitBounds(
      L.latLngBounds(places.map((place) => [place.lat, place.lng])),
      { padding: [28, 28] }
    );
    window.setTimeout(() => map.invalidateSize(), 150);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function bindStories() {
    const slot = document.getElementById("bai-cap");
    const lead = document.getElementById("bai-lon");
    const status = document.getElementById("bai-trang");
    if (!slot || !lead || !data().posts) return;
    const featured = data().posts.find((post) => post.featured) || data().posts[0];
    const rest = data().posts.filter((post) => post !== featured);
    const pageSize = 2;
    let page = 0;
    const pages = Math.max(1, Math.ceil(rest.length / pageSize));
    const prev = document.getElementById("bai-truoc");
    const next = document.getElementById("bai-sau");

    function paint() {
      const slice = rest.slice(page * pageSize, page * pageSize + pageSize);
      slot.replaceChildren();
      slice.forEach((post) => slot.append(storyLink(post, false)));
      if (prev) prev.disabled = page === 0;
      if (next) next.disabled = page >= pages - 1;
      if (status) {
        const from = page * pageSize + 1;
        const to = page * pageSize + slice.length;
        status.textContent = "Đang xem bài " + from + "–" + to + " trong " + rest.length + " bài.";
      }
    }

    lead.replaceChildren(storyLink(featured, true));
    paint();
    if (prev) prev.addEventListener("click", () => { if (page > 0) { page -= 1; paint(); } });
    if (next) next.addEventListener("click", () => { if (page < pages - 1) { page += 1; paint(); } });
  }

  function storyLink(post, large) {
    const link = document.createElement("a");
    link.className = large ? "story-card story-lead" : "story-card";
    link.href = "bai-viet.html?id=" + encodeURIComponent(post.id);
    const image = document.createElement("img");
    image.src = post.image;
    image.alt = post.imageAlt;
    image.width = large ? 1400 : 960;
    image.height = large ? 900 : 640;
    const copy = document.createElement("span");
    copy.className = "story-copy";
    const time = document.createElement("time");
    time.dateTime = post.iso;
    time.textContent = post.date;
    const title = document.createElement("h3");
    title.textContent = post.title;
    const excerpt = document.createElement("p");
    excerpt.textContent = post.excerpt;
    copy.append(time, title, excerpt);
    link.append(image, copy);
    return link;
  }

  function postsPage() {
    const root = document.getElementById("noi-dung-bai");
    if (!root) return;
    const id = params().get("id");
    root.classList.toggle("prose", Boolean(id));
    if (!id) {
      renderPostIndex(root, data().posts);
      return;
    }
    const post = data().getPost(id);
    if (!post) {
      document.title = "Không thấy bài · Location Insight";
      root.replaceChildren();
      root.append(el("h1", null, "Không thấy bài này"));
      const note = el("p", null, "Đường dẫn không khớp bài nào trong bản này.");
      const back = el("a", null, "Về danh sách bài viết");
      back.href = "bai-viet.html";
      root.append(note, back);
      return;
    }
    document.title = post.title + " · Location Insight";
    root.replaceChildren();
    const back = el("a", null, "Tất cả bài viết");
    back.href = "bai-viet.html";
    const kicker = el("p", "quiet-line", "Bài viết · " + post.date);
    root.append(back, kicker, el("h1", null, post.title));
    const image = document.createElement("img");
    image.src = post.image;
    image.alt = post.imageAlt;
    image.width = 1400;
    image.height = 900;
    root.append(image);
    post.paragraphs.forEach((paragraph) => root.append(el("p", null, paragraph)));
  }

  function renderPostIndex(root, posts) {
    document.title = "Bài viết · Location Insight";
    root.replaceChildren();
    root.append(el("h1", null, "Bài viết"));
    root.append(el("p", "lede", "Cách đọc một điểm ở Hà Nội. Đây là bài giải thích trong bản mock, không phải tin tức hay số người dùng."));
    const list = document.createElement("div");
    list.className = "story-index";
    posts.forEach((post) => {
      const link = document.createElement("a");
      link.className = "story-row";
      link.href = "bai-viet.html?id=" + encodeURIComponent(post.id);
      const image = document.createElement("img");
      image.src = post.image;
      image.alt = post.imageAlt;
      image.width = 960;
      image.height = 640;
      const copy = document.createElement("span");
      copy.className = "story-copy";
      const time = document.createElement("time");
      time.dateTime = post.iso;
      time.textContent = post.date;
      const title = document.createElement("h2");
      title.textContent = post.title;
      const excerpt = document.createElement("p");
      excerpt.textContent = post.excerpt;
      copy.append(time, title, excerpt);
      link.append(image, copy);
      list.append(link);
    });
    root.append(list);
  }

  function answerFor(question) {
    const text = question.toLowerCase();
    if (/ngập|mưa|sông/.test(text)) {
      return "Không kết luận dễ ngập. Báo cáo có cao độ tương đối và độ sâu ngập sông theo mô hình. Không có bản đồ ngập đường sau mưa của Hà Nội.";
    }
    if (/giá bán|khung giá|định giá|10\.?000|10k/.test(text)) {
      return "Khung giá không phải giá bán. Gói miễn phí và gói không giới hạn lượt chưa mở bước này. Bạn có thể trả 10.000 đồng cho một lần định giá, hoặc dùng gói có định giá. Thiếu pháp lý hoặc mặt tiền thì khung rộng ra, hoặc không kết luận.";
    }
    if (/gói|tháng|năm|miễn phí|lượt/.test(text)) {
      return "Miễn phí có khoảng 10 lượt so sánh mỗi ngày, chỉ xem điểm mạnh và điểm yếu. Gói không giới hạn lượt bỏ trần này. Gói có định giá thêm bước ước lượng giá. Giá tháng và năm trên trang là mức minh họa, chưa chốt.";
    }
    if (/ghim|lệch|địa chỉ/.test(text)) {
      return "Địa chỉ chỉ đưa bạn tới gần. Bộ tìm có thể lệch vài chục đến vài trăm mét, nhất là ngõ. Kéo ghim đúng ô đất. Báo cáo bám ghim, không bám chuỗi chữ.";
    }
    if (/thiếu|phủ|quy hoạch/.test(text)) {
      return "Không thấy dữ liệu trong bán kính thì ghi thiếu, kèm nguồn. Số tiện ích thấp nghĩa là bản đồ mỏng, không phải khu không có cửa hàng. Chưa có API quy hoạch theo tọa độ nên mục đó ghi chưa có dữ liệu.";
    }
    return "Câu này chưa khớp mục đã viết sẵn. Xem cột câu hay gặp, hoặc trang pháp lý. Bản mock chỉ trả lời từ những gì đã có trên trang, không gửi câu hỏi đi đâu.";
  }

  function foldQueryIsError(query) {
    return query.toLowerCase() === "loi" || query.toLowerCase() === "lỗi";
  }

  function loadingPage() {
    if (!store().requireSession()) return;
    const id = params().get("id") || "van-mieu";
    const place = data().getPlace(id);
    const link = document.getElementById("mo-bao-cao");
    const target = "bao-cao.html?id=" + encodeURIComponent(place ? place.id : "van-mieu");
    link.href = target;
    if (place) document.getElementById("dang-tai-ten").textContent = place.address;
    if (store().remaining() === 0) {
      document.getElementById("dang-tai-het").hidden = false;
      link.textContent = "Về màn ghim";
      link.href = "ghim.html";
      return;
    }
    store().consume();
    store().remember(place ? place.id : "van-mieu");
    window.setTimeout(() => {
      location.href = target;
    }, 1100);
  }

  function reportPage() {
    const query = params();
    const sample = query.get("mau") === "1";
    if (!sample && !store().requireSession()) return;
    const place = data().getPlace(query.get("id") || "");
    const root = document.getElementById("bao-cao");
    if (!place) {
      root.append(
        el("h1", "", "Chưa chọn điểm"),
        el("p", "lede", "Chọn một báo cáo mẫu hoặc ghim một địa chỉ trong Hà Nội."),
      );
      const actions = el("div", "row-actions");
      data().places.forEach((item) => {
        const link = el("a", "btn btn-secondary", item.title);
        link.href = "bao-cao.html?id=" + item.id + (sample || !store().session() ? "&mau=1" : "");
        actions.appendChild(link);
      });
      root.appendChild(actions);
      return;
    }

    const banner = el("div", "banner");
    banner.innerHTML = "<i data-lucide='info'></i><p></p>";
    banner.querySelector("p").textContent = sample
      ? "Đây là báo cáo mẫu. Số liệu minh họa cho bản mock, không phải kết quả đo của một thửa thật."
      : "Bản mock gắn báo cáo mẫu gần ghim. Máy tính không gian chưa chạy trong giao diện này.";
    root.appendChild(banner);

    const head = el("div", "report-head");
    const copy = el("div");
    copy.append(
      el("p", "quiet-line", "Báo cáo vị trí · cập nhật số mẫu " + data().UPDATED),
      el("h1", "", place.title),
      el("p", "lede", place.address),
    );
    const photo = el("figure", "figure-frame");
    const image = document.createElement("img");
    image.src = store().asset(place.image);
    image.alt = place.imageAlt;
    image.width = 1200;
    image.height = 800;
    const caption = el("figcaption", "", "Ảnh khu vực minh họa, không phải ảnh thửa đất.");
    photo.append(image, caption);
    head.append(copy, photo);
    root.appendChild(head);

    const kpis = el("div", "kpi-row");
    place.kpis.forEach((item) => {
      const block = el("div", "kpi");
      block.append(el("span", "meta", item.label), el("b", "", item.value), el("span", "meta", item.hint));
      kpis.appendChild(block);
    });
    root.appendChild(kpis);

    const summary = el("p", "prose", place.summary);
    root.appendChild(summary);

    const columns = el("div", "two-col");
    columns.append(listBlock("Điểm đang thấy", place.strengths), listBlock("Phần còn thiếu hoặc chưa kết luận", place.gaps));
    root.appendChild(columns);

    place.groups.forEach((group) => {
      const section = el("section", "metric-group");
      section.append(el("h2", "", group.title), el("p", "meta", group.intro));
      group.metrics.forEach((metric) => {
        const article = el("article", "metric");
        const header = document.createElement("header");
        header.append(el("h3", "", metric.label));
        const chip = el("span", "chip " + metric.confidence, data().CONFIDENCE_LABEL[metric.confidence]);
        header.appendChild(chip);
        const result = el("p", "", metric.result);
        const details = document.createElement("details");
        const summaryNode = el("summary", "", "Nguồn và bán kính");
        details.append(
          summaryNode,
          el("p", "meta", "Bán kính: " + metric.radius + ". Nguồn: " + metric.source + " Cập nhật mẫu: " + metric.updated + "."),
        );
        article.append(header, result, details);
        section.appendChild(article);
      });
      root.appendChild(section);
    });

    const actions = el("div", "sticky-actions");
    const price = el("a", "btn btn-primary", "Ước lượng giá");
    price.href = store().session()
      ? "dinh-gia.html?id=" + place.id
      : store().root() + "dang-nhap.html?next=" + encodeURIComponent("app/dinh-gia.html?id=" + place.id);
    const back = el("a", "btn btn-secondary", "Ghim điểm khác");
    back.href = store().session() ? "ghim.html" : store().root() + "dang-nhap.html?next=app/ghim.html";
    const history = el("a", "btn btn-ghost", "Lịch sử");
    history.href = store().session() ? "lich-su.html" : store().root() + "dang-nhap.html?next=app/lich-su.html";
    actions.append(price, back, history);
    if (store().session()) {
      const save = el("button", "btn btn-ghost", "Lưu vào lịch sử");
      save.type = "button";
      save.addEventListener("click", () => {
        store().remember(place.id);
        store().toast("Đã lưu " + place.title + " vào lịch sử trên máy này.");
      });
      actions.appendChild(save);
    }
    root.appendChild(actions);
    document.title = place.title + " · Location Insight";
  }

  function listBlock(title, items) {
    const section = el("section");
    section.appendChild(el("h2", "", title));
    const list = el("ul", "plain-list");
    items.forEach((item) => list.appendChild(el("li", "", item)));
    section.appendChild(list);
    return section;
  }

  function valuationPage() {
    if (!store().requireSession()) return;
    const place = data().getPlace(params().get("id") || "");
    const mount = document.getElementById("khung-dinh-gia");
    if (!place) {
      mount.append(el("h1", "", "Chưa có báo cáo để ước lượng"), el("p", "", "Mở một báo cáo vị trí trước."));
      return;
    }
    const saved = store().loadValuation(place.id) || {};
    mount.append(
      el("p", "quiet-line", "Lớp thứ hai · chỉ chạy khi bạn khai thêm"),
      el("h1", "", "Ước lượng giá cho " + place.title),
      el("p", "lede", "Hệ thống không suy diện tích, mặt tiền hay pháp lý từ tọa độ. Thiếu mặt tiền hoặc pháp lý thì khung rộng ra, hoặc không kết luận giá."),
    );
    const back = el("p");
    const reportLink = el("a", "", "Quay lại báo cáo vị trí");
    reportLink.href = "bao-cao.html?id=" + place.id;
    back.append(reportLink);
    mount.appendChild(back);

    const form = document.createElement("form");
    form.className = "form-stack";
    form.id = "form-gia";
    form.noValidate = true;
    form.innerHTML = [
      '<section class="form-section">',
      "<h2>Pháp lý và diện tích</h2>",
      field("kind", "Loại hình", selectKind(saved.kind), "Đổi loại thì các ô phía dưới đổi theo."),
      field("legal", "Pháp lý", selectLegal(saved.legal), "Đang vướng quy hoạch thì bản này không kết luận giá."),
      field("area", "Diện tích (m²)", input("area", "text", saved.area || "", "decimal"), "Ví dụ 45 hoặc 45,5."),
      field("asking", "Giá đang cân nhắc (tỷ đồng)", input("asking", "text", saved.asking || "", "decimal"), "Không bắt buộc. Ví dụ 5,2 nếu tin bạn đang xem là 5,2 tỷ. Đây không phải giá thị trường."),
      "</section>",
      '<section class="form-section" id="hinh-the">',
      "<h2>Hình thể ô đất</h2>",
      '<div class="pair">',
      field("frontage", "Mặt tiền (m)", input("frontage", "text", saved.frontage || "", "decimal"), "Bỏ trống thì khung giá phải rộng hơn."),
      field("depth", "Chiều sâu (m)", input("depth", "text", saved.depth || "", "decimal"), "Không bắt buộc."),
      "</div>",
      field("openSides", "Số mặt thoáng", input("openSides", "text", saved.openSides || "", "numeric"), "Không bắt buộc."),
      "</section>",
      '<section class="form-section" id="can-ho" hidden>',
      "<h2>Căn hộ</h2>",
      field("floors", "Tầng", input("floors", "text", saved.floors || "", "numeric"), "Thiếu tầng thì khung được nới nhẹ."),
      field("view", "Hướng view", input("view", "text", saved.view || "", "text"), "Không bắt buộc. Ví dụ hồ, nội khu, đường."),
      "</section>",
      '<button class="btn btn-primary" type="submit">Xem khung giá</button>',
    ].join("");
    mount.appendChild(form);

    const kind = form.querySelector("#kind");
    const land = document.getElementById("hinh-the");
    const flat = document.getElementById("can-ho");
    function syncKind() {
      const value = kind.value;
      land.hidden = value === "can-ho";
      flat.hidden = value !== "can-ho";
    }
    kind.addEventListener("change", syncKind);
    syncKind();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = {
        kind: form.kind.value,
        legal: form.legal.value,
        area: form.area.value,
        asking: form.asking.value,
        frontage: form.frontage.value,
        depth: form.depth.value,
        openSides: form.openSides.value,
        floors: form.floors.value,
        view: form.view.value,
      };
      let ok = true;
      if (!input.kind) {
        fieldError(form.kind, "Chọn đất, nhà phố hoặc căn hộ.");
        ok = false;
      } else fieldError(form.kind, "");
      if (!input.legal) {
        fieldError(form.legal, "Chọn tình trạng pháp lý bạn đang có.");
        ok = false;
      } else fieldError(form.legal, "");
      const area = data().parseDecimal(input.area);
      if (area === null || area <= 0) {
        fieldError(form.area, "Nhập diện tích lớn hơn 0. Dùng dấu phẩy hoặc dấu chấm đều được.");
        ok = false;
      } else fieldError(form.area, "");
      if (!ok) {
        form.querySelector("[aria-invalid='true']").focus();
        return;
      }
      store().saveValuation(place.id, input);
      location.href = "khoang-gia.html?id=" + place.id;
    });
  }

  function field(id, label, control, help) {
    return (
      '<div class="field"><label for="' +
      id +
      '">' +
      label +
      "</label>" +
      control +
      '<p class="help" id="' +
      id +
      '-help">' +
      help +
      "</p></div>"
    );
  }

  function input(id, type, value, mode) {
    return (
      '<input id="' +
      id +
      '" name="' +
      id +
      '" type="' +
      type +
      '" inputmode="' +
      mode +
      '" value="' +
      escapeAttr(value) +
      '" aria-describedby="' +
      id +
      '-help">'
    );
  }

  function selectKind(value) {
    return (
      '<select id="kind" name="kind" aria-describedby="kind-help">' +
      option("", "Chọn loại hình", !value) +
      option("dat", "Đất", value === "dat") +
      option("nha-pho", "Nhà phố", value === "nha-pho") +
      option("can-ho", "Căn hộ", value === "can-ho") +
      "</select>"
    );
  }

  function selectLegal(value) {
    return (
      '<select id="legal" name="legal" aria-describedby="legal-help">' +
      option("", "Chọn pháp lý", !value) +
      option("so", "Có sổ", value === "so") +
      option("hop-dong", "Hợp đồng, chưa sổ", value === "hop-dong") +
      option("vuong", "Đang vướng quy hoạch", value === "vuong") +
      "</select>"
    );
  }

  function option(value, label, selected) {
    return '<option value="' + value + '"' + (selected ? " selected" : "") + ">" + label + "</option>";
  }

  function escapeAttr(value) {
    return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function pricePage() {
    if (!store().requireSession()) return;
    const place = data().getPlace(params().get("id") || "");
    const mount = document.getElementById("ket-qua-gia");
    if (!place) return;
    const input = store().loadValuation(place.id);
    mount.append(el("p", "quiet-line", "Khung giá tham chiếu"), el("h1", "", place.title));
    if (!input) {
      mount.append(el("p", "lede", "Chưa có thuộc tính ô đất cho điểm này."));
      const link = el("a", "btn btn-primary", "Khai thuộc tính");
      link.href = "dinh-gia.html?id=" + place.id;
      mount.appendChild(link);
      return;
    }
    const outcome = data().evaluate(input, place);
    if (outcome.status === "refuse") {
      const banner = el("div", "banner warning");
      banner.innerHTML = "<i data-lucide='alert-triangle'></i><p></p>";
      banner.querySelector("p").textContent = outcome.reason;
      mount.appendChild(banner);
    } else {
      const figure = el("div", "range-figure");
      figure.append(
        el("span", "meta", "Khung minh họa, chưa phải giá bán"),
        el("strong", "", data().formatTy(outcome.lowTy) + " – " + data().formatTy(outcome.highTy)),
        el("p", "", data().formatTrieu(outcome.lowPerM2) + " – " + data().formatTrieu(outcome.highPerM2) + " · diện tích " + new Intl.NumberFormat("vi-VN").format(outcome.area) + " m²"),
      );
      mount.appendChild(figure);
      const meta = el("p", "", outcome.kindLabel + " · " + outcome.legalLabel + " · " + (place.priceContext === "noi-thanh" ? "khu nội thành mẫu" : "khu ngoại thành mẫu"));
      mount.appendChild(meta);
      if (outcome.asking !== null) {
        const inside = outcome.asking >= outcome.lowTy && outcome.asking <= outcome.highTy;
        const note = el(
          "p",
          "",
          "Giá bạn đang cân nhắc là " +
            data().formatTy(outcome.asking) +
            ". Số này " +
            (inside ? "nằm trong" : "nằm ngoài") +
            " khung minh họa. Đây là cách so một con số bạn đưa vào, không phải nhận định rẻ hay đắt trên thị trường.",
        );
        mount.appendChild(note);
      }
      if (outcome.widened.length) {
        mount.appendChild(listBlock("Vì sao khung rộng", outcome.widened));
      }
      mount.appendChild(listBlock("Giả định còn giữ", outcome.assumptions));
    }
    const actions = el("div", "row-actions");
    const edit = el("a", "btn btn-primary", "Sửa thuộc tính");
    edit.href = "dinh-gia.html?id=" + place.id;
    const report = el("a", "btn btn-secondary", "Xem lại báo cáo vị trí");
    report.href = "bao-cao.html?id=" + place.id;
    actions.append(edit, report);
    mount.appendChild(actions);
  }

  function historyPage() {
    if (!store().requireSession()) return;
    const mine = document.getElementById("cua-ban");
    const items = store().history();
    if (!items.length) {
      const empty = el("div", "empty");
      empty.append(
        el("h2", "", "Chưa có báo cáo của bạn"),
        el("p", "", "Ghim một điểm để lưu lượt phân tích trên máy này. Ba báo cáo mẫu vẫn mở được bên dưới."),
      );
      const link = el("a", "btn btn-primary", "Phân tích một điểm");
      link.href = "ghim.html";
      empty.appendChild(link);
      mine.appendChild(empty);
    } else {
      mine.appendChild(historyList(items.map((item) => data().getPlace(item.id)).filter(Boolean), false));
    }
    document.getElementById("mau").appendChild(historyList(data().places, true));
  }

  function historyList(places, sample) {
    const list = el("ul", "history-list");
    places.forEach((place) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = "bao-cao.html?id=" + place.id + (sample ? "&mau=1" : "");
      const image = document.createElement("img");
      image.src = store().asset(place.image);
      image.alt = "";
      image.width = 96;
      image.height = 72;
      const text = el("div");
      text.append(el("h3", "", place.title), el("p", "meta", place.address));
      const hint = el("span", "meta", place.coverage);
      link.append(image, text, hint);
      item.appendChild(link);
      list.appendChild(item);
    });
    return list;
  }

  function accountPage() {
    const user = store().requireSession();
    if (!user) return;
    document.getElementById("ten").value = user.name || "";
    document.getElementById("email").value = user.email;
    document.getElementById("con-lai").textContent = String(store().remaining());
    document.getElementById("tong").textContent = String(store().DAILY);
    document.getElementById("form-ten").addEventListener("submit", (event) => {
      event.preventDefault();
      const name = document.getElementById("ten").value.trim();
      if (name.length < 2) {
        fieldError(document.getElementById("ten"), "Tên cần ít nhất 2 ký tự.");
        return;
      }
      fieldError(document.getElementById("ten"), "");
      store().signIn({ name, email: user.email });
      store().toast("Đã lưu tên trên máy này.");
      const chip = document.querySelector("[data-user]");
      if (chip) chip.textContent = user.email;
    });
    document.getElementById("dang-xuat").addEventListener("click", () => {
      store().signOut();
      location.href = store().root() + "index.html";
    });
  }

  window.LIPages = {
    landing: landingPage,
    "bai-viet": postsPage,
    login: loginPage,
    register: registerPage,
    forgot: forgotPage,
    reset: resetPage,
    ghim: ghimPage,
    "dang-tai": loadingPage,
    "bao-cao": reportPage,
    "dinh-gia": valuationPage,
    "khoang-gia": pricePage,
    "lich-su": historyPage,
    "tai-khoan": accountPage,
  };
})();
