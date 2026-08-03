// Logic per al CMS Admin Panel amb Contrasenya
document.addEventListener('DOMContentLoaded', () => {
  checkAuthSession();

  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const articleForm = document.getElementById('articleForm');
  if (articleForm) articleForm.addEventListener('submit', handleCreateArticle);

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);
});

function getAuthToken() {
  return sessionStorage.getItem('admin_token') || '';
}

function checkAuthSession() {
  const token = getAuthToken();
  const loginCard = document.getElementById('loginCard');
  const adminContent = document.getElementById('adminContent');

  if (token) {
    loginCard.style.display = 'none';
    adminContent.style.display = 'block';
    loadAdminArticles();
  } else {
    loginCard.style.display = 'block';
    adminContent.style.display = 'none';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const passwordInput = document.getElementById('adminPassword');
  const errorEl = document.getElementById('loginError');
  const password = passwordInput.value.trim();

  errorEl.style.display = 'none';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      sessionStorage.setItem('admin_token', password);
      checkAuthSession();
    } else {
      errorEl.textContent = data.error || 'Contrasenya incorrecta.';
      errorEl.style.display = 'block';
    }
  } catch (err) {
    errorEl.textContent = "Error de connexió amb el servidor.";
    errorEl.style.display = 'block';
  }
}

function handleLogout() {
  sessionStorage.removeItem('admin_token');
  checkAuthSession();
}

// Carregar articles a la taula d'administració
async function loadAdminArticles() {
  const tbody = document.getElementById('adminArticlesTbody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/articles');
    const articles = await res.json();

    if (articles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No hi ha cap article publicat.</td></tr>`;
      return;
    }

    tbody.innerHTML = articles.map(art => `
      <tr>
        <td style="width: 80px;">
          <img src="${art.image}" alt="${art.title}" style="width: 60px; height: 45px; object-fit: cover; border-radius: 4px;">
        </td>
        <td>
          <strong style="color: var(--text-main);">${art.title}</strong>
          ${art.subtitle ? `<br><small style="color: var(--text-muted);">${art.subtitle}</small>` : ''}
        </td>
        <td><span class="gallery-item-badge">${art.category}</span></td>
        <td style="font-size: 0.85rem; color: var(--text-muted);">${art.date}</td>
        <td>
          <button class="btn-danger" onclick="deleteArticle('${art.id}', '${art.title}')">Esborrar</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error("Error carregant articles al CMS:", err);
    tbody.innerHTML = `<tr><td colspan="5" style="color: red; text-align: center;">Error carregant la llista d'articles.</td></tr>`;
  }
}

// Enviar nou article al backend amb capçalera d'autenticació
async function handleCreateArticle(e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = document.getElementById('btnSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Publicant...';

  const formData = new FormData(form);

  try {
    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: {
        'x-admin-password': getAuthToken()
      },
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "No s'ha pogut guardar l'article.");
    }

    alert("✅ Article publicat amb èxit!");
    form.reset();
    loadAdminArticles();
  } catch (err) {
    alert("❌ Error: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publicar Article Ara';
  }
}

// Eliminar un article amb capçalera d'autenticació
async function deleteArticle(id, title) {
  if (!confirm(`Estàs segur/a de voler esborrar l'article "${title}"?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/articles/${id}`, {
      method: 'DELETE',
      headers: {
        'x-admin-password': getAuthToken()
      }
    });

    if (!res.ok) throw new Error("No s'ha pogut eliminar l'article.");

    alert("🗑️ Article eliminat correctament.");
    loadAdminArticles();
  } catch (err) {
    alert("❌ Error: " + err.message);
  }
}
