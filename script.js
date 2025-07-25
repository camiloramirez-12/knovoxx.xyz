// Muestra el año actual en el footer
const yearSpan = document.querySelector("#year, #year-login, #year-dashboard");
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}

// Animación suave de carga (opcional: agregar loading spinner en HTML si se desea)

// Lógica para login simulado
document.addEventListener("DOMContentLoaded", () => {
  const pageId = document.body.id;

  if (pageId === "login-page") {
    const form = document.getElementById("loginForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const user = document.getElementById("username").value.trim();
      const pass = document.getElementById("password").value.trim();

      const regUser = localStorage.getItem("registeredUser");
      const regPass = localStorage.getItem("registeredPass");

      if (!user || !pass) {
        return Swal.fire("Campos vacíos", "Por favor completa los campos.", "warning");
      }

      if (user === regUser && pass === regPass) {
        const remember = document.getElementById("rememberMe").checked;

        // Solo guarda si marcó "Recordarme"
        if (remember) {
          localStorage.setItem("username", user);
        } else {
          sessionStorage.setItem("username", user); // solo mientras el navegador esté abierto
        }

        Swal.fire("Bienvenido", `Hola, ${user}`, "success").then(() => {
          window.location.href = "dashboard.html";
        });
      }
    });
  }

  if (pageId === "dashboard-page") {
    const user = localStorage.getItem("username");
    if (!user) return window.location.href = "login.html";

    const name = localStorage.getItem("registeredName");
const welcome = document.getElementById("welcomeMessage");
if (welcome) welcome.textContent = `Bienvenido, ${name || user}`;


    const logoutBtn = document.getElementById("logoutBtn");
    logoutBtn?.addEventListener("click", () => {
      Swal.fire("Cerrando sesión", "¡Hasta luego!", "info").then(() => {
        localStorage.removeItem("username");
        window.location.href = "login.html";
      });
    });
  }
});
