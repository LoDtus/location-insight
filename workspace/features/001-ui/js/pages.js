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
    const next = params().get("next");
    if (next === "dang-tin.html") {
      const lede = document.querySelector(".auth-card .lede");
      const submit = form.querySelector("[type='submit']");
      if (lede) lede.textContent = "Chỉ cần tên, email và mật khẩu. Xong là vào mẫu soạn tin rao bán.";
      if (submit) submit.textContent = "Tạo tài khoản và soạn tin";
    }
    const loginLink = document.querySelector(".auth-card a[href='dang-nhap.html']");
    if (loginLink && next) loginLink.href = "dang-nhap.html?next=" + encodeURIComponent(next);
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
      location.href = store().safeNext(params().get("next"));
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
    bindListings();

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
    let current = null;
    let stageOpen = false;
    let stageMode = "detail";
    let bearing = 0;
    let swallowClick = false;
    let savedFilter = "";
    let pendingDelete = "";
    let zoomControlBar = null;
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
      current = { lat: place.lat, lng: place.lng, name: place.title, place: place, note: note || "" };
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
      paintStage();
    }

    function showEmpty(message, latlng) {
      active = null;
      current = latlng
        ? { lat: latlng.lat, lng: latlng.lng, name: "Điểm chưa có số đo", place: null, note: "" }
        : null;
      panel.replaceChildren(el("h3", null, "Chưa có số đo"), el("p", null, message));
      document.querySelectorAll("[data-place]").forEach((button) => button.setAttribute("aria-pressed", "false"));
      status.textContent = message;
      paintStage();
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

    function select(place, meters, options) {
      const fly = !options || options.fly !== false;
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
      if (stageOpen) {
        if (fly) moveTo(place);
        return;
      }
      markers[place.id].bindPopup(popupHtml(place, note), { maxWidth: 320, minWidth: 240, maxHeight: 280, autoPan: true, keepInView: true }).openPopup();
      if (fly) moveTo(place);
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
      showEmpty(message, latlng);
      if (!map) return;
      if (stray) stray.remove();
      stray = L.marker(latlng, { draggable: true, icon: markerIcon() }).addTo(map);
      stray.on("dragend", () => {
        const point = stray.getLatLng();
        const near = data().nearest(point.lat, point.lng);
        if (near.meters <= 600) select(near.place, near.meters, { fly: false });
        else miss(point);
      });
      if (stageOpen) return;
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

    function runSearchFrom(value) {
      const query = value.trim();
      const wideInput = document.getElementById("tim-rong");
      if (search && search.value !== value) search.value = value;
      if (wideInput && wideInput.value !== value) wideInput.value = value;
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
      search.addEventListener("change", () => runSearchFrom(search.value));
      search.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        runSearchFrom(search.value);
      });
    }

    const mapNode = document.getElementById("ban-do-tra");
    if (!mapNode || !window.L) {
      status.textContent = "Không tải được bản đồ. Vẫn chọn một điểm đã đo ở phía trên để đọc điểm mạnh và điểm yếu.";
      bindStage(null, null);
      return;
    }

    const places = data().places;
    map = L.map(mapNode, { scrollWheelZoom: true, boxZoom: true, zoomControl: false });
    const zoomBar = L.control.zoom({ zoomInTitle: "Phóng to", zoomOutTitle: "Thu nhỏ" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const icon = markerIcon();
    places.forEach((place) => {
      const marker = L.marker([place.lat, place.lng], { icon }).addTo(map);
      marker.bindTooltip(place.title, { direction: "top" });
      marker.on("click", () => select(place, 0));
      markers[place.id] = marker;
    });
    map.on("click", (event) => {
      if (swallowClick) {
        swallowClick = false;
        return;
      }
      hideMenu();
      const fly = !event.originalEvent || !event.originalEvent.altKey;
      const near = data().nearest(event.latlng.lat, event.latlng.lng);
      if (near.meters <= 600) select(near.place, near.meters, { fly: fly });
      else miss(event.latlng);
    });
    const homeBounds = L.latLngBounds(places.map((place) => [place.lat, place.lng]));
    map.fitBounds(homeBounds, { padding: [28, 28] });
    map.on("move zoom", applyBearing);
    bindStage(homeBounds, zoomBar);
    openSharedPoint();
    window.setTimeout(() => map.invalidateSize(), 150);

    function pointKey(lat, lng) {
      return Number(lat).toFixed(5) + "," + Number(lng).toFixed(5);
    }

    function findSaved(lat, lng) {
      const key = pointKey(lat, lng);
      return store().savedPlaces().find((row) => pointKey(row.lat, row.lng) === key) || null;
    }

    function applyBearing() {
      if (!map) return;
      const pane = map.getPane("mapPane");
      if (!pane) return;
      const base = (pane.style.transform || "").replace(/ rotate\([^)]+\)/g, "");
      pane.style.transformOrigin = "50% 50%";
      pane.style.transform = Math.abs(bearing) > 0.4 ? base + " rotate(" + bearing.toFixed(1) + "deg)" : base;
    }

    function paintCompass() {
      const node = document.getElementById("la-ban");
      if (!node) return;
      const turned = Math.abs(bearing) > 0.5;
      node.hidden = !turned;
      if (turned) node.textContent = "Đang xoay " + Math.round(bearing) + "°. Quay về vị trí ban đầu để đặt hướng bắc.";
    }

    function hideMenu() {
      const menu = document.getElementById("menu-chuot");
      if (menu) menu.hidden = true;
    }

    function copyText(value) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(value).catch(() => fallbackCopy(value));
      }
      return fallbackCopy(value);
    }

    function fallbackCopy(value) {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      return Promise.resolve();
    }

    function sharePoint() {
      const point = current || (map ? { lat: map.getCenter().lat, lng: map.getCenter().lng, name: "Tâm bản đồ" } : null);
      if (!point) {
        store().toast("Chưa có điểm để chia sẻ.");
        return;
      }
      const url = new URL(location.href);
      url.searchParams.set("diem", point.lat.toFixed(5) + "," + point.lng.toFixed(5));
      url.searchParams.set("z", String(map ? Math.round(map.getZoom()) : 12));
      url.searchParams.set("rong", "1");
      url.hash = "tra-cuu";
      const link = url.toString();
      const copied = () => store().toast(current ? "Đã chép liên kết vị trí đang xem." : "Đã chép liên kết tâm bản đồ.");
      if (navigator.share) {
        navigator.share({ title: point.name, text: point.name + " trên Location Insight", url: link }).catch((error) => {
          if (error && error.name === "AbortError") return;
          copyText(link).then(copied);
        });
        return;
      }
      copyText(link).then(copied);
    }

    function paintStage() {
      const root = document.getElementById("noi-dung-rong");
      const savedBtn = document.getElementById("dia-diem-da-luu");
      if (!root) return;
      if (savedBtn) savedBtn.setAttribute("aria-pressed", stageMode === "saved" ? "true" : "false");
      if (stageMode === "saved") paintSaved(root);
      else paintDetail(root);
    }

    function paintDetail(root) {
      root.replaceChildren();
      const title = el("h3", null, current ? current.name : "Chưa chọn điểm");
      title.id = "tieu-de-chi-tiet-rong";
      root.append(title);
      if (!current) {
        root.append(el("p", null, "Chấm lên bản đồ hoặc tìm một điểm đã đo. Nút dấu trang mở các địa điểm đã lưu trên máy này."));
        return;
      }
      if (current.place) {
        root.append(el("p", null, current.place.address));
        if (current.note) root.append(el("p", "fine", current.note));
        root.append(el("h4", null, "Điểm mạnh"), list(current.place.strengths));
        root.append(el("h4", null, "Điểm yếu hoặc chưa kết luận"), list(current.place.gaps));
        const report = el("a", null, "Xem báo cáo đầy đủ");
        report.href = "app/bao-cao.html?id=" + encodeURIComponent(current.place.id) + "&mau=1";
        root.append(report);
      } else {
        root.append(el("p", null, current.lat.toFixed(5) + ", " + current.lng.toFixed(5)));
        root.append(el("p", null, "Điểm này chưa có số đo. Có thể lưu để xem lại. Trang không điền điểm mạnh hay điểm yếu."));
      }
      const saved = findSaved(current.lat, current.lng);
      const form = el("form", "map-save");
      form.append(fieldInput("ten-diem", "Tên địa điểm", "text", saved ? saved.name : current.name));
      form.append(fieldInput("nhom-diem", "Nhóm", "text", saved ? saved.category : ""));
      const group = form.querySelector("#nhom-diem");
      group.setAttribute("list", "goi-y-nhom");
      group.setAttribute("placeholder", "Muốn xem lại, Đang so sánh…");
      const hints = el("datalist");
      hints.id = "goi-y-nhom";
      ["Muốn xem lại", "Đang so sánh", "Không hợp"].forEach((name) => {
        const option = el("option");
        option.value = name;
        hints.append(option);
      });
      form.append(hints);
      const noteWrap = el("div", "field");
      const noteLabel = el("label", null, "Ghi chú");
      noteLabel.htmlFor = "ghi-chu-diem";
      const note = el("textarea");
      note.id = "ghi-chu-diem";
      note.name = "ghi";
      note.rows = 3;
      note.value = saved && saved.note ? saved.note : "";
      noteWrap.append(noteLabel, note);
      form.append(noteWrap);
      form.append(el("button", "btn btn-primary", saved ? "Cập nhật địa điểm" : "Lưu địa điểm"));
      form.querySelector("button").type = "submit";
      if (store().savedPlaces().length >= 35) {
        form.append(el("p", "fine", "Máy này giữ tối đa 40 địa điểm. Lưu thêm sẽ bỏ địa điểm cũ nhất."));
      }
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const nameInput = form.querySelector("#ten-diem");
        const name = nameInput.value.trim();
        if (!name) {
          fieldError(nameInput, "Nhập tên địa điểm trước khi lưu.");
          nameInput.focus();
          return;
        }
        fieldError(nameInput, "");
        store().putSaved({
          id: saved ? saved.id : "s-" + Date.now().toString(36),
          name: name,
          lat: current.lat,
          lng: current.lng,
          category: form.querySelector("#nhom-diem").value.trim(),
          note: note.value.trim(),
          at: new Date().toISOString(),
        });
        store().toast(saved ? "Đã cập nhật địa điểm." : "Đã lưu địa điểm trên máy này.");
        paintStage();
      });
      root.append(form);
    }

    function fieldInput(id, label, type, value) {
      const wrap = el("div", "field");
      const lab = el("label", null, label);
      lab.htmlFor = id;
      const input = el("input");
      input.id = id;
      input.name = id;
      input.type = type;
      input.value = value || "";
      wrap.append(lab, input);
      return wrap;
    }

    function paintSaved(root) {
      root.replaceChildren();
      const title = el("h3", null, "Địa điểm đã lưu");
      title.id = "tieu-de-chi-tiet-rong";
      const back = el("button", "btn btn-secondary", "Quay lại điểm đang xem");
      back.type = "button";
      back.addEventListener("click", () => {
        stageMode = "detail";
        pendingDelete = "";
        paintStage();
      });
      root.append(title, back);
      const items = store().savedPlaces();
      const groups = [];
      items.forEach((item) => {
        const name = item.category || "Chưa phân loại";
        if (!groups.includes(name)) groups.push(name);
      });
      if (groups.length > 1) {
        const wrap = el("div", "field");
        const lab = el("label", null, "Xem theo nhóm");
        lab.htmlFor = "loc-nhom";
        const pick = el("select");
        pick.id = "loc-nhom";
        const all = el("option", null, "Tất cả nhóm");
        all.value = "";
        pick.append(all);
        groups.forEach((name) => {
          const option = el("option", null, name);
          option.value = name;
          if (name === savedFilter) option.selected = true;
          pick.append(option);
        });
        pick.addEventListener("change", () => {
          savedFilter = pick.value;
          paintSaved(root);
        });
        wrap.append(lab, pick);
        root.append(wrap);
      }
      const shown = items.filter((item) => !savedFilter || (item.category || "Chưa phân loại") === savedFilter);
      if (!shown.length) {
        root.append(el("p", null, items.length ? "Không có địa điểm trong nhóm này." : "Chưa lưu địa điểm nào. Chấm một điểm, rồi ghi nhóm và ghi chú."));
        return;
      }
      const listNode = el("div", "saved-list");
      shown.forEach((item) => {
        const row = el("article", "saved-row");
        const open = el("button", "saved-open");
        open.type = "button";
        open.append(el("strong", null, item.name), el("span", null, item.category || "Chưa phân loại"));
        if (item.note) open.append(el("span", null, item.note));
        open.append(el("span", "fine", new Date(item.at).toLocaleDateString("vi-VN")));
        open.addEventListener("click", () => openSaved(item));
        row.append(open);
        if (pendingDelete === item.id) {
          const keep = el("button", "btn btn-secondary", "Giữ lại");
          keep.type = "button";
          keep.addEventListener("click", () => {
            pendingDelete = "";
            paintSaved(root);
          });
          const drop = el("button", "btn btn-danger", "Xóa hẳn");
          drop.type = "button";
          drop.addEventListener("click", () => {
            store().removeSaved(item.id);
            pendingDelete = "";
            store().toast("Đã xóa địa điểm.");
            paintSaved(root);
          });
          row.append(keep, drop);
        } else {
          const drop = el("button", "btn btn-secondary", "Xóa");
          drop.type = "button";
          drop.addEventListener("click", () => {
            pendingDelete = item.id;
            paintSaved(root);
          });
          row.append(drop);
        }
        listNode.append(row);
      });
      root.append(listNode);
    }

    function openSaved(item) {
      stageMode = "detail";
      pendingDelete = "";
      if (!window.L) {
        current = { lat: item.lat, lng: item.lng, name: item.name, place: null, note: "" };
        paintStage();
        return;
      }
      const near = data().nearest(item.lat, item.lng);
      if (near.meters <= 600) select(near.place, near.meters, { fly: true });
      else miss(L.latLng(item.lat, item.lng));
    }

    function showMenu(x, y, latlng) {
      const menu = document.getElementById("menu-chuot");
      if (!menu) return;
      menu.replaceChildren();
      const actions = [
        ["Xem điểm này", () => {
          const near = data().nearest(latlng.lat, latlng.lng);
          if (near.meters <= 600) select(near.place, near.meters, { fly: false });
          else miss(latlng);
        }],
        ["Lưu địa điểm", () => {
          const near = data().nearest(latlng.lat, latlng.lng);
          if (near.meters <= 600) select(near.place, near.meters, { fly: false });
          else miss(latlng);
          stageMode = "detail";
          window.setTimeout(() => {
            const input = document.getElementById("ten-diem");
            if (input) input.focus();
          }, 0);
        }],
        ["Chia sẻ vị trí", sharePoint],
        ["Phóng to", () => map && map.zoomIn()],
        ["Thu nhỏ", () => map && map.zoomOut()],
      ];
      actions.forEach(([label, run]) => {
        const button = el("button", null, label);
        button.type = "button";
        button.setAttribute("role", "menuitem");
        button.addEventListener("click", () => {
          hideMenu();
          run();
        });
        menu.append(button);
      });
      menu.hidden = false;
      const width = 240;
      const left = Math.min(x, window.innerWidth - width - 8);
      const top = Math.min(y, window.innerHeight - 240);
      menu.style.left = Math.max(8, left) + "px";
      menu.style.top = Math.max(8, top) + "px";
      menu.querySelector("button").focus();
    }

    function openStage() {
      const stage = document.getElementById("ban-do-rong");
      const slot = document.getElementById("ban-do-cho");
      const node = document.getElementById("ban-do-tra");
      const openBtn = document.getElementById("mo-ban-do");
      if (!stage || !slot || !node) return;
      stage.hidden = false;
      stageOpen = true;
      document.body.classList.add("map-open");
      slot.insertBefore(node, slot.firstChild);
      if (openBtn) openBtn.setAttribute("aria-expanded", "true");
      if (zoomControlBar) zoomControlBar.remove();
      closePopups();
      paintStage();
      window.setTimeout(() => {
        if (map) map.invalidateSize();
      }, 60);
      const input = document.getElementById("tim-rong");
      if (input) input.focus();
    }

    function closeStage() {
      const stage = document.getElementById("ban-do-rong");
      const slot = document.querySelector(".map-slot");
      const node = document.getElementById("ban-do-tra");
      const openBtn = document.getElementById("mo-ban-do");
      if (!stage || !slot || !node) return;
      hideMenu();
      stage.hidden = true;
      stageOpen = false;
      document.body.classList.remove("map-open");
      slot.insertBefore(node, slot.firstChild);
      if (openBtn) openBtn.setAttribute("aria-expanded", "false");
      if (map && zoomControlBar) zoomControlBar.addTo(map);
      window.setTimeout(() => {
        if (map) map.invalidateSize();
      }, 60);
      if (openBtn) openBtn.focus();
    }

    function bindStage(bounds, zoomControl) {
      zoomControlBar = zoomControl;
      const openBtn = document.getElementById("mo-ban-do");
      const closeBtn = document.getElementById("dong-ban-do");
      const form = document.getElementById("form-tim-rong");
      if (openBtn) openBtn.addEventListener("click", openStage);
      if (closeBtn) closeBtn.addEventListener("click", closeStage);
      if (form) {
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          runSearchFrom(document.getElementById("tim-rong").value);
        });
      }
      const zoomIn = document.getElementById("phong-to");
      const zoomOut = document.getElementById("thu-nho");
      const reset = document.getElementById("ve-dau");
      const share = document.getElementById("chia-se-diem");
      const savedBtn = document.getElementById("dia-diem-da-luu");
      if (!map) {
        [zoomIn, zoomOut, reset].forEach((button) => {
          if (button) button.disabled = true;
        });
      }
      if (zoomIn) zoomIn.addEventListener("click", () => map && map.zoomIn());
      if (zoomOut) zoomOut.addEventListener("click", () => map && map.zoomOut());
      if (reset) {
        reset.addEventListener("click", () => {
          bearing = 0;
          applyBearing();
          paintCompass();
          if (!map || !bounds) return;
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (reduce) map.fitBounds(bounds, { padding: [28, 28] });
          else map.flyToBounds(bounds, { padding: [28, 28] });
        });
      }
      if (share) share.addEventListener("click", sharePoint);
      if (savedBtn) {
        savedBtn.addEventListener("click", () => {
          stageMode = stageMode === "saved" ? "detail" : "saved";
          pendingDelete = "";
          if (!stageOpen) openStage();
          else paintStage();
        });
      }
      document.addEventListener("keydown", (event) => {
        if (!stageOpen) return;
        if (event.key !== "Escape") return;
        const menu = document.getElementById("menu-chuot");
        if (menu && !menu.hidden) {
          hideMenu();
          return;
        }
        closeStage();
      });
      if (!map) return;
      const shell = map.getContainer();
      let gesture = null;
      let menuTimer = 0;
      let lastRight = 0;
      const toLatLng = map.mouseEventToLatLng.bind(map);
      map.mouseEventToLatLng = function (event) {
        if (Math.abs(bearing) < 0.4) return toLatLng(event);
        const rect = shell.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        const rad = (bearing * Math.PI) / 180;
        const rx = x * Math.cos(rad) + y * Math.sin(rad);
        const ry = -x * Math.sin(rad) + y * Math.cos(rad);
        return toLatLng({ clientX: rect.left + rect.width / 2 + rx, clientY: rect.top + rect.height / 2 + ry });
      };
      shell.addEventListener("pointerdown", (event) => {
        if (event.button === 0 && event.shiftKey) return;
        const rotate = event.button === 2 || (event.button === 0 && event.ctrlKey);
        const altZoom = event.button === 0 && event.altKey && !event.ctrlKey;
        if (!rotate && !altZoom) return;
        map.dragging.disable();
        gesture = {
          kind: rotate ? "rotate" : "altzoom",
          x: event.clientX,
          y: event.clientY,
          bearing: bearing,
          zoom: map.getZoom(),
          moved: false,
          id: event.pointerId,
        };
        if (shell.setPointerCapture) shell.setPointerCapture(event.pointerId);
      }, true);
      shell.addEventListener("pointermove", (event) => {
        if (!gesture || event.pointerId !== gesture.id) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) gesture.moved = true;
        if (gesture.kind === "rotate") {
          bearing = gesture.bearing + dx * 0.35;
          applyBearing();
          paintCompass();
          return;
        }
        const next = gesture.zoom + (gesture.y - event.clientY) / 90;
        map.setZoom(Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), next)));
      });
      function endGesture(event) {
        if (!gesture || (event && event.pointerId !== gesture.id)) return;
        const moved = gesture.moved;
        gesture = null;
        map.dragging.enable();
        if (moved) {
          swallowClick = true;
          window.setTimeout(() => {
            swallowClick = false;
          }, 350);
        }
      }
      shell.addEventListener("pointerup", endGesture);
      shell.addEventListener("pointercancel", endGesture);
      shell.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        const now = Date.now();
        if (now - lastRight < 320) {
          lastRight = 0;
          window.clearTimeout(menuTimer);
          hideMenu();
          map.zoomOut();
          return;
        }
        lastRight = now;
        if (gesture && gesture.moved) return;
        const moved = swallowClick;
        window.clearTimeout(menuTimer);
        if (moved) return;
        const latlng = map.mouseEventToLatLng(event);
        menuTimer = window.setTimeout(() => showMenu(event.clientX, event.clientY, latlng), 280);
      });
      map.on("boxzoomend", () => {
        status.textContent = "Đã phóng tới vùng vừa khoanh.";
      });
      map.on("movestart", hideMenu);
    }

    function openSharedPoint() {
      const raw = params().get("diem");
      if (raw && map) {
        const parts = raw.split(",");
        const lat = Number(parts[0]);
        const lng = Number(parts[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const near = data().nearest(lat, lng);
          if (near.meters <= 600) select(near.place, near.meters, { fly: false });
          else miss(L.latLng(lat, lng));
          const zoom = Number(params().get("z"));
          map.setView([lat, lng], Number.isFinite(zoom) ? zoom : map.getZoom());
        }
      }
      if (params().get("rong") === "1") openStage();
    }
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

  function bindListings() {
    const board = document.getElementById("danh-sach-tin");
    const form = document.getElementById("form-dang-tin");
    const confirm = document.getElementById("xac-nhan-tin");
    const cta = document.getElementById("nut-rao-ban");
    if (cta && store().session()) {
      cta.href = "dang-tin.html";
      cta.textContent = "Rao bán tại đây";
    }
    if (board) paintStored(board);
    if (!form) return;
    if (!store().session()) {
      location.href = "dang-ky.html?next=" + encodeURIComponent("dang-tin.html");
      return;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const area = Number(form.dienTich.value);
      const price = Number(form.gia.value);
      const front = form.matTien.value.trim();
      const phone = form.lienHe.value.replace(/[^\d]/g, "");
      let invalid = false;
      invalid = requireField(form.loai, form.loai.value, "Chọn loại căn.") || invalid;
      invalid = requireField(form.khu, form.khu.value.trim(), "Nhập khu hoặc phường ở Hà Nội.") || invalid;
      invalid = requireField(form.dienTich, area > 0, "Nhập diện tích lớn hơn 0.") || invalid;
      invalid = requireField(form.gia, price > 0, "Nhập giá chào lớn hơn 0.") || invalid;
      invalid = requireField(form.phapLy, form.phapLy.value, "Chọn tình trạng pháp lý người đăng khai.") || invalid;
      invalid = requireField(form.lienHe, phone.length >= 9 && phone.length <= 11, "Nhập số điện thoại 9 đến 11 chữ số.") || invalid;
      if (invalid) {
        const first = form.querySelector("[aria-invalid='true']");
        if (first) first.focus();
        return;
      }
      const unit = form.donVi.value === "trieu" ? " triệu" : " tỷ";
      const frontText = front && Number(front) > 0 ? Number(front).toLocaleString("vi-VN") + " m" : "Chưa khai";
      const item = {
        id: "t-" + Date.now().toString(36),
        priceText: price.toLocaleString("vi-VN") + unit,
        loai: form.loai.value,
        khu: form.khu.value.trim(),
        area: area.toLocaleString("vi-VN") + " m²",
        front: frontText,
        phapLy: form.phapLy.value,
        phone,
        note: form.moTa.value.trim(),
      };
      store().putListing(item);
      form.reset();
      if (confirm) {
        confirm.hidden = false;
        confirm.replaceChildren();
        const line = document.createElement("span");
        line.append(
          document.createTextNode("Đã ghi tin trên máy này. "),
          Object.assign(document.createElement("a"), { href: "app/tin.html", textContent: "Xem trong tin của tôi" }),
          document.createTextNode(". Tin cũng hiện ở "),
          Object.assign(document.createElement("a"), { href: "index.html#dang-tin", textContent: "mục tin đang chào" }),
          document.createTextNode(". Bản mock chưa đưa tin lên chỗ công khai, chưa kiểm tra sổ.")
        );
        confirm.append(line);
        confirm.focus();
      }
    });

    function requireField(input, ok, message) {
      fieldError(input, ok ? "" : message);
      return !ok;
    }
  }

  function paintStored(board) {
    const items = store().listings();
    for (let i = items.length - 1; i >= 0; i -= 1) board.prepend(listingRow(items[i]));
  }

  function listingRow(item) {
    const row = el("article", "listing-row");
    const body = el("div");
    const kicker = el("p", "listing-kicker");
    const badge = el("span", "listing-badge is-own", "Tin của bạn");
    kicker.append(badge, document.createTextNode(" " + item.loai + " · " + item.khu));
    const specs = el("dl", "listing-specs");
    specs.append(
      spec("Diện tích", item.area),
      spec("Mặt tiền", item.front),
      spec("Pháp lý khai", item.phapLy),
      spec("Liên hệ", item.phone)
    );
    const note = el(
      "p",
      "fine",
      (item.note ? item.note + " " : "") + "Giá chào do bạn nhập. Bản mock chưa đăng công khai và chưa kiểm tra sổ."
    );
    body.append(kicker, specs, note);
    const photo = el("img");
    photo.src = store().asset("images/ngo-ha-noi-ngang.webp");
    photo.width = 160;
    photo.height = 120;
    photo.alt = "Ảnh ngõ Hà Nội dùng tạm cho tin vừa soạn, không phải ảnh căn này.";
    row.append(el("p", "listing-price", item.priceText), body, photo);
    return row;

    function spec(label, value) {
      const wrap = el("div");
      wrap.append(el("dt", null, label), el("dd", null, value));
      return wrap;
    }
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
    const list = document.getElementById("danh-sach-bai");
    const root = document.getElementById("noi-dung-bai");
    if (!root) return;
    const id = params().get("id");
    if (!id) {
      if (list) list.hidden = false;
      root.hidden = true;
      renderPostIndex(data().posts);
      return;
    }
    if (list) list.hidden = true;
    root.hidden = false;
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
    const kicker = el("p", "quiet-line", (post.topic ? post.topic + " · " : "Bài viết · ") + post.date);
    root.append(back, kicker, el("h1", null, post.title));
    const image = document.createElement("img");
    image.src = post.image;
    image.alt = post.imageAlt;
    image.width = 1400;
    image.height = 900;
    root.append(image);
    post.paragraphs.forEach((paragraph) => root.append(el("p", null, paragraph)));
  }

  function renderPostIndex(posts) {
    document.title = "Bài viết · Location Insight";
    const featured = posts.find((post) => post.featured) || posts[0];
    const latest = posts.filter((post) => post !== featured).slice(0, 4);
    const lead = document.getElementById("bai-noi-bat");
    const fresh = document.getElementById("bai-moi");
    if (lead && featured) lead.replaceChildren(featureLink(featured));
    if (fresh) {
      fresh.replaceChildren();
      latest.forEach((post) => fresh.append(latestItem(post)));
    }
    paintPostGrid(posts);
    bindPostSlide(posts);
  }

  function featureLink(post) {
    const link = document.createElement("a");
    link.className = "post-feature";
    link.href = "bai-viet.html?id=" + encodeURIComponent(post.id);
    const image = document.createElement("img");
    image.src = post.image;
    image.alt = post.imageAlt;
    image.width = 1400;
    image.height = 900;
    const copy = el("span", "post-feature-copy");
    if (post.topic) copy.append(el("span", "post-topic", post.topic));
    const title = el("h2", null, post.title);
    const time = document.createElement("time");
    time.dateTime = post.iso;
    time.textContent = post.date;
    copy.append(title, time);
    link.append(image, copy);
    return link;
  }

  function latestItem(post) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = "bai-viet.html?id=" + encodeURIComponent(post.id);
    const image = document.createElement("img");
    image.src = post.image;
    image.alt = "";
    image.width = 72;
    image.height = 72;
    const copy = el("span");
    const title = el("h3", null, post.title);
    const time = document.createElement("time");
    time.dateTime = post.iso;
    time.textContent = post.date;
    copy.append(title, time);
    link.append(image, copy);
    item.append(link);
    return item;
  }

  function paintPostGrid(posts) {
    const grid = document.getElementById("luoi-bai");
    const status = document.getElementById("trang-bai");
    const pager = document.getElementById("phan-trang");
    if (!grid || !pager) return;
    const pageSize = 9;
    const pages = Math.max(1, Math.ceil(posts.length / pageSize));
    const raw = Number(params().get("trang") || "1");
    const asked = Number.isInteger(raw) && raw >= 1 ? raw : 1;
    const page = asked > pages ? 1 : asked;
    const slice = posts.slice((page - 1) * pageSize, page * pageSize);
    grid.replaceChildren();
    slice.forEach((post) => grid.append(gridCard(post)));
    if (status) {
      const from = (page - 1) * pageSize + 1;
      const to = (page - 1) * pageSize + slice.length;
      status.textContent =
        (asked > pages ? "Không có trang " + asked + ". Đang mở trang 1. " : "") +
        "Bài " + from + "–" + to + " trong " + posts.length + ".";
    }
    pager.replaceChildren();
    pager.append(pageLink(page - 1, pages, "Trang trước", "arrow-left", page === 1));
    for (let index = 1; index <= pages; index += 1) {
      const link = document.createElement("a");
      link.href = index === 1 ? "bai-viet.html" : "bai-viet.html?trang=" + index;
      link.textContent = String(index);
      if (index === page) link.setAttribute("aria-current", "page");
      link.setAttribute("aria-label", "Trang " + index);
      pager.append(link);
    }
    pager.append(pageLink(page + 1, pages, "Trang sau", "arrow-right", page === pages));
    store().icons();
  }

  function pageLink(target, pages, label, icon, disabled) {
    if (disabled || target < 1 || target > pages) {
      const span = el("span", "is-disabled");
      span.setAttribute("aria-disabled", "true");
      span.append(el("i"));
      span.querySelector("i").setAttribute("data-lucide", icon);
      span.setAttribute("aria-label", label);
      return span;
    }
    const link = document.createElement("a");
    link.href = target === 1 ? "bai-viet.html" : "bai-viet.html?trang=" + target;
    link.setAttribute("aria-label", label);
    link.append(el("i"));
    link.querySelector("i").setAttribute("data-lucide", icon);
    return link;
  }

  function gridCard(post) {
    const link = document.createElement("a");
    link.className = "post-tile";
    link.href = "bai-viet.html?id=" + encodeURIComponent(post.id);
    const media = el("span", "post-tile-media");
    const image = document.createElement("img");
    image.src = post.image;
    image.alt = post.imageAlt;
    image.width = 960;
    image.height = 640;
    image.loading = "lazy";
    media.append(image);
    if (post.topic) media.append(el("span", "post-topic", post.topic));
    const title = el("h3", null, post.title);
    const excerpt = el("p", null, post.excerpt);
    const time = document.createElement("time");
    time.dateTime = post.iso;
    time.textContent = post.date;
    link.append(media, title, excerpt, time);
    return link;
  }

  function bindPostSlide(posts) {
    const stage = document.getElementById("truot-bai");
    const title = document.getElementById("tieu-de-truot");
    const topic = document.getElementById("chu-de-truot");
    const status = document.getElementById("trang-truot");
    const prev = document.getElementById("truot-truoc");
    const next = document.getElementById("truot-sau");
    if (!stage || !posts.length || stage.dataset.bound === "1") return;
    stage.dataset.bound = "1";
    let index = 0;

    function paint() {
      const current = posts[index];
      const upcoming = posts[(index + 1) % posts.length];
      stage.replaceChildren(slideCard(current, false), slideCard(upcoming, true));
      if (title) title.textContent = current.title;
      if (topic) topic.textContent = current.topic || "Đọc lần lượt";
      if (status) status.textContent = "Bài " + (index + 1) + " / " + posts.length + ". Bài kế tiếp nhô trên bài đang xem.";
    }

    function step(delta) {
      index = (index + delta + posts.length) % posts.length;
      paint();
    }

    if (prev) prev.addEventListener("click", () => step(-1));
    if (next) next.addEventListener("click", () => step(1));
    paint();
  }

  function slideCard(post, peek) {
    const link = document.createElement("a");
    link.className = peek ? "post-slide-card is-peek" : "post-slide-card";
    link.href = "bai-viet.html?id=" + encodeURIComponent(post.id);
    if (peek) link.setAttribute("aria-label", post.title + ", bài kế tiếp");
    const image = document.createElement("img");
    image.src = post.image;
    image.alt = peek ? "" : post.imageAlt;
    image.width = 1200;
    image.height = 800;
    const copy = el("span", "post-slide-copy");
    const title = el("h3", null, post.title);
    const time = document.createElement("time");
    time.dateTime = post.iso;
    time.textContent = post.date;
    copy.append(title, time);
    link.append(image, copy);
    return link;
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

  function lookupAppPage() {
    if (!store().requireSession()) return;
    const input = document.getElementById("tim-diem");
    const results = document.getElementById("ket-qua-tim");
    const card = document.getElementById("the-diem");
    const mapNode = document.getElementById("map");
    const status = document.getElementById("trang-thai-tim");
    let map = null;
    let pin = null;
    let selected = null;

    function paintCard() {
      card.replaceChildren();
      if (!selected) {
        card.append(el("p", null, "Chọn một điểm đã đo trong danh sách, hoặc chấm lên bản đồ."));
        return;
      }
      const place = selected.place;
      card.append(el("h2", null, place ? place.title : "Điểm chưa có số đo"));
      card.append(el("p", null, place ? place.address : selected.lat.toFixed(5) + ", " + selected.lng.toFixed(5)));
      card.append(
        el(
          "p",
          "fine",
          place
            ? place.coverage + ". " + place.coverageHint + "."
            : "Trang không điền điểm mạnh hay điểm yếu cho điểm chưa đo."
        )
      );
      const actions = el("div", "row-actions");
      const analyze = el("a", "btn btn-primary", "Phân tích điểm này");
      analyze.href = place ? "ghim.html?q=" + encodeURIComponent(place.title) : "ghim.html";
      const already = store().savedPlaces().some((row) => nearPoint(row.lat, row.lng, selected.lat, selected.lng, 30));
      const save = el("button", "btn btn-secondary", already ? "Đã có trong mục đã lưu" : "Lưu địa điểm");
      save.type = "button";
      save.disabled = already;
      save.addEventListener("click", () => {
        store().putSaved({
          id: "s-" + Date.now().toString(36),
          name: place ? place.title : "Điểm " + selected.lat.toFixed(4) + ", " + selected.lng.toFixed(4),
          lat: selected.lat,
          lng: selected.lng,
          category: "Muốn xem lại",
          note: "",
          at: new Date().toISOString(),
        });
        store().toast("Đã lưu địa điểm trên máy này.");
        paintCard();
      });
      actions.append(analyze, save);
      card.append(actions);
    }

    function choose(place, lat, lng) {
      selected = { place: place || null, lat: lat, lng: lng };
      if (pin) pin.setLatLng([lat, lng]);
      if (map) map.setView([lat, lng], place ? 15 : 16);
      paintCard();
      status.textContent = place ? "Đang xem " + place.title + "." : "Điểm này chưa có số đo.";
      results.querySelectorAll("button").forEach((button) => {
        button.setAttribute("aria-selected", place && button.dataset.id === place.id ? "true" : "false");
      });
    }

    function pick(lat, lng) {
      const near = data().nearest(lat, lng);
      if (near && near.meters <= 500) choose(near.place, near.place.lat, near.place.lng);
      else choose(null, lat, lng);
    }

    function paintResults(items) {
      results.replaceChildren();
      if (!items.length) {
        const item = el("li");
        const button = el("button", "", "Không thấy điểm đã đo khớp. Thử «Văn Miếu», «Hồ Gươm» hoặc «Nội Bài».");
        button.type = "button";
        button.disabled = true;
        item.appendChild(button);
        results.appendChild(item);
        return;
      }
      items.forEach((place) => {
        const item = el("li");
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.id = place.id;
        button.innerHTML = "<strong></strong><br><span class='meta'></span>";
        button.querySelector("strong").textContent = place.title;
        button.querySelector("span").textContent = place.address;
        button.addEventListener("click", () => choose(place, place.lat, place.lng));
        item.appendChild(button);
        results.appendChild(item);
      });
    }

    input.form.addEventListener("submit", (event) => event.preventDefault());
    input.addEventListener("input", () => {
      const query = input.value.trim();
      paintResults(query ? data().searchPlaces(query) : data().places);
    });
    paintResults(data().places);
    paintCard();

    const diem = params().get("diem");
    if (!window.L) {
      status.textContent = "Không tải được bản đồ. Vẫn chọn một điểm đã đo ở danh sách.";
      if (diem) openSavedPoint(diem, choose);
      return;
    }
    const start = data().places[0];
    map = L.map(mapNode, { scrollWheelZoom: true }).setView([start.lat, start.lng], 12);
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
    data().places.forEach((place) => {
      L.marker([place.lat, place.lng], { icon, keyboard: false })
        .addTo(map)
        .on("click", () => choose(place, place.lat, place.lng));
    });
    pin = L.marker([start.lat, start.lng], { draggable: true, icon: icon, zIndexOffset: 500 }).addTo(map);
    pin.on("dragend", () => {
      const point = pin.getLatLng();
      pick(point.lat, point.lng);
    });
    map.on("click", (event) => pick(event.latlng.lat, event.latlng.lng));
    if (diem) openSavedPoint(diem, choose);
    window.setTimeout(() => map.invalidateSize(), 150);
  }

  function openSavedPoint(diem, choose) {
    const parts = diem.split(",");
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const near = data().nearest(lat, lng);
    if (near && near.meters <= 80) choose(near.place, near.place.lat, near.place.lng);
    else choose(null, lat, lng);
  }

  function nearPoint(lat, lng, otherLat, otherLng, meters) {
    const dLat = (lat - otherLat) * 111000;
    const dLng = (lng - otherLng) * 111000 * Math.cos((lat * Math.PI) / 180);
    return Math.hypot(dLat, dLng) <= meters;
  }

  function myListingsPage() {
    if (!store().requireSession()) return;
    const board = document.getElementById("tin-cua-toi");
    const empty = document.getElementById("tin-trong");

    function paint() {
      const items = store().listings();
      board.replaceChildren();
      empty.hidden = items.length > 0;
      items.forEach((item) => {
        const row = listingRow(item);
        const actions = el("div", "row-actions");
        const remove = el("button", "btn btn-secondary", "Gỡ tin");
        remove.type = "button";
        remove.addEventListener("click", () => askRemove(actions, "Gỡ hẳn", () => {
          store().removeListing(item.id);
          store().toast("Đã gỡ tin khỏi máy này.");
          paint();
        }, () => paint()));
        actions.append(remove);
        row.querySelector("div").append(actions);
        board.append(row);
      });
    }

    paint();
  }

  function savedPage() {
    if (!store().requireSession()) return;
    const list = document.getElementById("danh-sach-luu");
    const empty = document.getElementById("luu-trong");
    const filterWrap = document.getElementById("loc-nhom-khung");
    const filter = document.getElementById("loc-nhom");
    const count = document.getElementById("so-diem-luu");

    function paint() {
      const items = store().savedPlaces();
      const groups = [];
      items.forEach((item) => {
        if (item.category && groups.indexOf(item.category) === -1) groups.push(item.category);
      });
      const current = filter.value;
      filter.replaceChildren(new Option("Tất cả", ""));
      groups.forEach((name) => filter.append(new Option(name, name)));
      if (groups.indexOf(current) !== -1) filter.value = current;
      filterWrap.hidden = groups.length < 2;
      const shown = filter.value ? items.filter((item) => item.category === filter.value) : items;
      count.textContent = items.length ? items.length + " địa điểm trên máy này." : "";
      list.replaceChildren();
      empty.hidden = shown.length > 0;
      shown.forEach((item) => {
        const row = el("li", "manage-item");
        const text = el("div");
        text.append(el("h2", null, item.name));
        const meta = [item.category, item.lat.toFixed(5) + ", " + item.lng.toFixed(5)].filter(Boolean).join(" · ");
        text.append(el("p", "meta", meta));
        if (item.note) text.append(el("p", null, item.note));
        const actions = el("div", "row-actions");
        const open = el("a", "btn btn-secondary", "Mở trên bản đồ");
        open.href = "tra-cuu.html?diem=" + encodeURIComponent(item.lat + "," + item.lng);
        const near = data().nearest(item.lat, item.lng);
        if (near && near.meters <= 80) {
          const analyze = el("a", "btn btn-secondary", "Phân tích");
          analyze.href = "ghim.html?q=" + encodeURIComponent(near.place.title);
          actions.append(analyze);
        }
        const remove = el("button", "btn btn-secondary", "Xóa");
        remove.type = "button";
        remove.addEventListener("click", () => askRemove(actions, "Xóa hẳn", () => {
          store().removeSaved(item.id);
          store().toast("Đã xóa địa điểm đã lưu.");
          paint();
        }, () => paint()));
        actions.append(open, remove);
        row.append(text, actions);
        list.append(row);
      });
    }

    filter.addEventListener("change", paint);
    paint();
  }

  function askRemove(host, label, onRemove, onKeep) {
    host.replaceChildren();
    const keep = el("button", "btn btn-primary", "Giữ lại");
    keep.type = "button";
    const gone = el("button", "btn btn-secondary", label);
    gone.type = "button";
    keep.addEventListener("click", onKeep);
    gone.addEventListener("click", onRemove);
    host.append(keep, gone);
    keep.focus();
  }

  window.LIPages = {
    landing: landingPage,
    "bai-viet": postsPage,
    login: loginPage,
    register: registerPage,
    "dang-tin": bindListings,
    forgot: forgotPage,
    reset: resetPage,
    ghim: ghimPage,
    "dang-tai": loadingPage,
    "bao-cao": reportPage,
    "dinh-gia": valuationPage,
    "khoang-gia": pricePage,
    "lich-su": historyPage,
    "tai-khoan": accountPage,
    "tra-cuu": lookupAppPage,
    tin: myListingsPage,
    "da-luu": savedPage,
  };
})();
