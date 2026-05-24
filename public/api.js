async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("token");

  const config = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { "Authorization": "Bearer " + token } : {})
    }
  };

  let res;
  try {
    res = await fetch(url, config);
  } catch (err) {
    console.error("Error de red:", err);
    throw err;
  }

  if (res.status === 401) {
    localStorage.clear();
    location.href = "index.html";
    return null;
  }

  return res;
}

function escHTML(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}