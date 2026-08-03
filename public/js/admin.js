// Logic per al CMS Admin Panel amb suport d'Imatges per a Vercel
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

// Enviar nou article al backend amb conversió d'imatge a DataURL (per a compatibilitat total amb Vercel)
async function handleCreateArticle(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('btnSubmit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Publicant...';

  const title = document.getElementById('title').value;
  const subtitle = document.getElementById('subtitle').value;
  const category = document.getElementById('category').value;
  const author = document.getElementById('author').value;
  const summary = document.getElementById('summary').value;
  const content = document.getElementById('content').value;
  const imageFileInput = document.getElementById('imageFile');

  let imageDataUrl = '';
  if (imageFileInput && imageFileInput.files && imageFileInput.files[0]) {
    try {
      imageDataUrl = await readFileAsDataURL(imageFileInput.files[0]);
    } catch (err) {
      console.error("Error llegint imatge:", err);
    }
  }

  const payload = {
    title,
    subtitle,
    category,
    author,
    summary,
    content,
    image: imageDataUrl || '/expo_img/1688980723144.jpg'
  };

  try {
    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': getAuthToken()
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "No s'ha pogut guardar l'article.");
    }

    alert("✅ Article publicat amb èxit!");
    document.getElementById('articleForm').reset();
    loadAdminArticles();
  } catch (err) {
    alert("❌ Error: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publicar Article Ara';
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Eliminar un article
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
