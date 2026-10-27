const button = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
if (button && nav) {
  button.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.setAttribute("aria-label", open ? "Đóng menu" : "Mở menu");
  });
}
