document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const usuario  = document.getElementById("usuario").value.trim();
  const password = document.getElementById("password").value;
  const rango    = document.getElementById("rango").value;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, password, rango })
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Usuario, contraseña o rol incorrecto.");
      return;
    }
    localStorage.setItem("token",   data.token);
    localStorage.setItem("id",      data.id);
    localStorage.setItem("usuario", data.usuario);
    localStorage.setItem("permiso", data.permiso);
    localStorage.setItem("rango",   data.rango);

    if (data.cambiar) {
      location.href = "cambiar.html?usuario=" + encodeURIComponent(data.usuario);
    } else {
      location.href = "dashboard.html";
    }

  } catch (err) {
    console.error("Error de red:", err);
    alert("No se pudo conectar con el servidor. Verificá tu conexión.");
  }
});