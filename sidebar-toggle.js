/* GEOTRACIA — menú lateral móvil sin botón visible "Cerrar menú".
   Se cierra al tocar fuera, seleccionar una sección o pulsar Escape. */
(() => {
  "use strict";
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const menu = document.getElementById("menu");
  if (!sidebar || !overlay || !menu) return;

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
  };

  menu.setAttribute("aria-controls", "sidebar");
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-label", "Mostrar menú de módulos");
  menu.addEventListener("click", (event) => {
    if (!isMobile()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    sidebar.classList.contains("open") ? hide() : show();
  }, true);

  overlay.addEventListener("click", hide);
  sidebar.querySelectorAll("[data-go], #nav [data-module], #nav button").forEach((item) => {
    item.addEventListener("click", () => { if (isMobile()) hide(); }, true);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar.classList.contains("open")) {
      hide();
      menu.focus({ preventScroll: true });
    }
  });
  window.addEventListener("resize", () => {
    if (!isMobile()) hide();
  });
})();
