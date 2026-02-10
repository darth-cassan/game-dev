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

  const contactForm = document.getElementById("contactModalForm");
  const statusLabel = document.getElementById("contactFormStatus");
  const contactModal = document.getElementById("contactoModal");

  if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const formData = new FormData(contactForm);
      const name = String(formData.get("name") || "").trim();
      const email = String(formData.get("email") || "").trim();
      const message = String(formData.get("message") || "").trim();

      if (!name || !email || !message) {
        if (statusLabel) {
          statusLabel.textContent = "Completa todos los campos antes de enviar.";
        }
        return;
      }

      const subject = `Contacto web - ${name}`;
      const body = `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${message}`;
      const mailtoUrl = `mailto:games@darthcassan.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      if (statusLabel) {
        statusLabel.textContent = "Abriendo tu app de correo. Si no se abre, escribe a games@darthcassan.com.";
      }

      if (window.bootstrap && contactModal) {
        const modal = window.bootstrap.Modal.getOrCreateInstance(contactModal);
        modal.hide();
      }

      window.location.href = mailtoUrl;
    });
  }
})();
