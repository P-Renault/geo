/* GEOTRACIA v0.4.1 — control accesible para contraer la navegación lateral */
(() => {
  "use strict";
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const menu = document.getElementById("menu");
  if (!sidebar || !overlay || !menu || document.getElementById("sidebarClose")) return;

  const close = document.createElement("button");
  close.id = "sidebarClose";
  close.type = "button";
  close.className = "sidebar-close";
  close.setAttribute("aria-label", "Ocultar menú de módulos");
  close.setAttribute("title", "Ocultar menú");
  close.innerHTML = '<span aria-hidden="true">×</span><span class="sidebar-close-label">Cerrar menú</span>';
  sidebar.insertBefore(close, sidebar.firstChild);

  const isMobile = () => window.matchMedia("(max-width: 1000px)").matches;
  const hide = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
    menu.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-label", "Mostrar menú de módulos");
    document.body.classList.remove("sidebar-menu-open");
  };
  const show = () => {
    if (!isMobile()) return;
    sidebar.classList.add("open");
    overlay.classList.add("show");
    menu.setAttribute("aria-expanded", "true");
    menu.setAttribute("aria-label", "Ocultar menú de módulos");
    document.body.classList.add("sidebar-menu-open");
    close.focus({ preventScroll: true });
  };

  // Replace the original toggle with predictable open/close behavior.
  menu.setAttribute("aria-controls", "sidebar");
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-label", "Mostrar menú de módulos");
  menu.addEventListener("click", (event) => {
    if (!isMobile()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    sidebar.classList.contains("open") ? hide() : show();
  }, true);
  close.addEventListener("click", hide);
  overlay.addEventListener("click", hide);
  sidebar.querySelectorAll("[data-go]").forEach((item) => item.addEventListener("click", () => {
    if (isMobile()) hide();
  }, true));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar.classList.contains("open")) {
      hide();
      menu.focus({ preventScroll: true });
    }
  });
  window.addEventListener("resize", () => {
    if (!isMobile()) {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
      document.body.classList.remove("sidebar-menu-open");
    }
  });
})();
