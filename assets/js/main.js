(function () {
  const nav = document.getElementById("siteNav");
  const yearLabel = document.getElementById("currentYear");

  if (yearLabel) {
    yearLabel.textContent = String(new Date().getFullYear());
  }

  function toggleNavState() {
    if (!nav) return;
    nav.classList.toggle("scrolled", window.scrollY > 18);
  }

  toggleNavState();
  window.addEventListener("scroll", toggleNavState);

  const links = document.querySelectorAll('a[href^="#"]');
  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href");
      if (!targetId || targetId === "#") return;
      const target = document.querySelector(targetId);
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
})();
