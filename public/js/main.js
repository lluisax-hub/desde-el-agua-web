// Frontend Logic - Projecte 'Desde El Agua'
document.addEventListener('DOMContentLoaded', () => {
  initLanguage();
  initGallery();
  initArticles();
  initLightbox();
  initArticleModal();
  initNavbarScroll();
});

let galleryData = [];
let articlesData = [];
let currentLang = localStorage.getItem('site_lang') || 'ca';

// 0. Gestió d'Idiomes (Català / Castellà)
function initLanguage() {
  applyLanguage(currentLang);

  const langBtns = document.querySelectorAll('.lang-btn');
  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedLang = btn.getAttribute('data-lang');
      if (selectedLang && selectedLang !== currentLang) {
        currentLang = selectedLang;
        localStorage.setItem('site_lang', currentLang);
        applyLanguage(currentLang);
      }
    });
  });
}

function applyLanguage(lang) {
  const dict = translations[lang] || translations['ca'];

  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.getAttribute('data-lang') === lang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      if (key === 'hero_title_1' || key === 'hero_subtitle' || key === 'concept_desc' || key === 'book_p1' || key === 'book_p2' || key === 'artist_desc') {
        el.innerHTML = dict[key];
      } else {
        el.textContent = dict[key];
      }
    }
  });

  document.documentElement.lang = lang;
}

// 1. Carregar i Inicialitzar Galeria
async function initGallery() {
  const galleryGrid = document.getElementById('galleryGrid');
  if (!galleryGrid) return;

  try {
    const res = await fetch('/api/gallery');
    if (!res.ok) throw new Error("Error en carregar les imatges de la galeria");
    galleryData = await res.json();
    
    renderGallery(galleryData);
    setupFilterButtons();
  } catch (err) {
    console.error(err);
    galleryGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        <p>No s'han pogut carregar les imatges de la galeria en aquest moment.</p>
      </div>
    `;
  }
}

function renderGallery(items) {
  const galleryGrid = document.getElementById('galleryGrid');
  if (!galleryGrid) return;

  if (items.length === 0) {
    galleryGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No hi ha imatges disponibles en aquesta categoria.</p>`;
    return;
  }

  galleryGrid.innerHTML = items.map(item => `
    <div class="gallery-card" data-category="${item.category}" onclick="openLightbox('${item.url}', '${item.title}')">
      <div class="gallery-thumb">
        <img src="${item.url}" alt="${item.title}" loading="lazy">
      </div>
      <div class="gallery-info">
        <span class="gallery-item-title">${item.title}</span>
        <span class="gallery-item-badge">${item.category}</span>
      </div>
    </div>
  `).join('');
}

function setupFilterButtons() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');
      if (filter === 'all') {
        renderGallery(galleryData);
      } else {
        const filtered = galleryData.filter(item => item.category === filter);
        renderGallery(filtered);
      }
    });
  });
}

// Helper per obtenir una imatge vàlida d'article
function getValidArticleImage(imgAttr) {
  if (!imgAttr) return '/expo_img/1688980723144.jpg';
  if (imgAttr.startsWith('data:image') || imgAttr.startsWith('/expo_img/') || imgAttr.startsWith('http')) {
    return imgAttr;
  }
  return '/expo_img/1688980723144.jpg';
}

// 2. Carregar i Renderitzar Articles del Backend
async function initArticles() {
  const articlesGrid = document.getElementById('articlesGrid');
  if (!articlesGrid) return;

  try {
    const res = await fetch('/api/articles');
    if (!res.ok) throw new Error("Error en carregar els articles");
    articlesData = await res.json();

    if (articlesData.length === 0) {
      articlesGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
          <p>Encara no s'ha publicat cap article. Utilitza el <a href="/admin.html" style="color: var(--accent-slate); text-decoration: underline;">Gestor CMS</a> per publicar el primer!</p>
        </div>
      `;
      return;
    }

    articlesGrid.innerHTML = articlesData.map(art => {
      const imgSrc = getValidArticleImage(art.image);

      return `
        <article class="article-card" style="cursor: pointer;" onclick="openArticleModal('${art.id}')">
          <div class="article-img-wrap">
            <img src="${imgSrc}" alt="${art.title}" loading="lazy" onerror="this.onerror=null; this.src='/expo_img/1688980723144.jpg';">
          </div>
          <div class="article-body">
            <div class="article-meta">
              <span class="article-cat">${art.category}</span>
              <span class="article-date">${formatDate(art.date)}</span>
            </div>
            <h3 class="article-title">${art.title}</h3>
            ${art.subtitle ? `<h4 class="article-subtitle">${art.subtitle}</h4>` : ''}
            <p class="article-summary">${art.summary || art.content}</p>
            <div class="article-footer">
              <span class="article-author">Per ${art.author}</span>
              <span style="color: var(--accent-slate); font-weight: 600;">Llegir +</span>
            </div>
          </div>
        </article>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    articlesGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Error en carregar els articles.</p>`;
  }
}

// 3. Modal d'Article Complet (Lectura)
function initArticleModal() {
  const modal = document.getElementById('articleModal');
  const closeBtn = document.getElementById('articleModalClose');

  if (!modal) return;

  closeBtn?.addEventListener('click', closeArticleModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeArticleModal();
  });
}

function openArticleModal(id) {
  const art = articlesData.find(a => a.id === id);
  if (!art) return;

  const modal = document.getElementById('articleModal');
  const catEl = document.getElementById('artModalCat');
  const dateEl = document.getElementById('artModalDate');
  const titleEl = document.getElementById('artModalTitle');
  const subtitleEl = document.getElementById('artModalSubtitle');
  const authorEl = document.getElementById('artModalAuthor');
  const imgEl = document.getElementById('artModalImg');
  const contentEl = document.getElementById('artModalContent');
  const modalBox = modal ? modal.querySelector('.lightbox-content') : null;

  if (!modal) return;

  const imgSrc = getValidArticleImage(art.image);

  if (catEl) catEl.textContent = art.category;
  if (dateEl) dateEl.textContent = formatDate(art.date);
  if (titleEl) titleEl.textContent = art.title;
  if (subtitleEl) subtitleEl.textContent = art.subtitle || '';
  if (authorEl) authorEl.textContent = `Per ${art.author}`;
  
  if (imgEl) {
    imgEl.src = imgSrc;
    imgEl.style.display = 'block';
    imgEl.style.width = '100%';
    imgEl.style.maxHeight = '420px';
    imgEl.style.objectFit = 'cover';
    imgEl.onerror = () => { imgEl.src = '/expo_img/1688980723144.jpg'; };
  }
  
  if (contentEl) contentEl.innerHTML = art.content.replace(/\n/g, '<br><br>');

  // Reiniciar scroll a la part superior de la finestra
  if (modalBox) modalBox.scrollTop = 0;
  
  modal.classList.add('active');
}

function closeArticleModal() {
  const modal = document.getElementById('articleModal');
  if (modal) modal.classList.remove('active');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  try {
    return new Date(dateStr).toLocaleDateString(currentLang === 'es' ? 'es-ES' : 'ca-ES', options);
  } catch (e) {
    return dateStr;
  }
}

// 4. Lightbox Functionality
function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  const closeBtn = document.getElementById('lightboxClose');

  if (!lightbox) return;

  closeBtn?.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightbox();
      closeArticleModal();
    }
  });
}

function openLightbox(url, title) {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  const caption = document.getElementById('lightboxCaption');

  if (!lightbox || !img) return;

  img.src = url;
  img.alt = title;
  caption.textContent = title;
  lightbox.classList.add('active');
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (lightbox) lightbox.classList.remove('active');
}

// 5. Smooth Scroll
function initNavbarScroll() {
  const links = document.querySelectorAll('.nav-link');
  window.addEventListener('scroll', () => {
    let fromTop = window.scrollY + 100;
    links.forEach(link => {
      const section = document.querySelector(link.hash);
      if (section) {
        if (
          section.offsetTop <= fromTop &&
          section.offsetTop + section.offsetHeight > fromTop
        ) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      }
    });
  });
}
