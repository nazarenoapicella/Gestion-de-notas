document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const usuario = document.getElementById("usuario").value;
  const password = document.getElementById("password").value;
  const rango = document.getElementById("rango").value;

   const res = await fetch("/api/login", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ usuario, password, rango })
  });
   const data = await res.json();

  if (!data.success) return alert("Error");
  
  localStorage.setItem("id", data.id);

  localStorage.setItem("usuario", data.usuario);

  localStorage.setItem("permiso", data.permiso);

  localStorage.setItem("rango", data.rango);

  if (data.cambiar) {
    location.href = "cambiar.html?usuario=" + data.usuario;
  } else {
    location.href = "dashboard.html?id=" + data.id;
  }
    

});