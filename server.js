const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'eva';

// Cerquem totes les possibles variables de Redis / Upstash / KV de Vercel
function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || 
              process.env.UPSTASH_REDIS_REST_URL || 
              process.env.STORAGE_REST_API_URL || 
              process.env.UPSTASH_KV_REST_API_URL;

  const token = process.env.KV_REST_API_TOKEN || 
                process.env.UPSTASH_REDIS_REST_TOKEN || 
                process.env.STORAGE_REST_API_TOKEN || 
                process.env.UPSTASH_KV_REST_API_TOKEN;

  return { url, token };
}

// Middleware amb límit augmentat per a imatges en DataURL
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Directoris
const publicDir = path.join(__dirname, 'public');
const expoImgDir = path.join(__dirname, 'desde el agua documentación gráfica de la expo');
const uploadsDir = path.join(__dirname, 'uploads');
const dataFile = path.join(__dirname, 'data', 'articles.json');

// Assegurar directoris
if (!fs.existsSync(uploadsDir)) {
  try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) {}
}

app.use(express.static(publicDir));
app.use('/expo_img', express.static(expoImgDir));
app.use('/uploads', express.static(uploadsDir));

// Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = process.env.VERCEL ? '/tmp' : uploadsDir;
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'article-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Helper llegir articles locals de data/articles.json
function getInitialLocalArticles() {
  try {
    if (!fs.existsSync(dataFile)) return [];
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (err) {
    return [];
  }
}

// Helper asíncron per carregar articles (des de Redis si està connectat, o local)
async function getArticlesAsync() {
  const { url, token } = getRedisConfig();

  if (url && token && url.startsWith('http')) {
    try {
      // 1. Provar mètode REST directe /get/articles
      const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
      const res = await fetch(`${cleanUrl}/get/articles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data && data.result) {
        const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.error("Error llegint de Redis (/get/articles):", err);
    }
  }
  return getInitialLocalArticles();
}

// Helper asíncron per desar articles (a Redis i local)
async function saveArticlesAsync(articles) {
  const { url, token } = getRedisConfig();

  if (url && token && url.startsWith('http')) {
    try {
      const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
      await fetch(`${cleanUrl}/set/articles`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(JSON.stringify(articles))
      });
    } catch (err) {
      console.error("Error desant a Redis (/set/articles):", err);
    }
  }

  if (!process.env.VERCEL) {
    try {
      fs.writeFileSync(dataFile, JSON.stringify(articles, null, 2), 'utf8');
    } catch (err) {}
  }
}

// Middleware auth
function checkAuth(req, res, next) {
  const authHeader = req.headers['x-admin-password'] || req.body.password;
  if (authHeader === ADMIN_PASSWORD) {
    return next();
  }
  return res.status(401).json({ error: "Contrasenya d'administrador incorrecta." });
}

// Endpoint de diagnòstic de la base de dades
app.get('/api/debug-db', (req, res) => {
  const { url, token } = getRedisConfig();
  res.json({
    connected: !!(url && token),
    redis_url_found: url ? url.substring(0, 25) + '...' : 'NO TROBAT',
    is_http: url ? url.startsWith('http') : false,
    environment: process.env.VERCEL ? 'VERCEL_CLOUD' : 'LOCAL'
  });
});

// REST API Endpoints
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD, message: "Accés concedit." });
  } else {
    res.status(401).json({ success: false, error: "Contrasenya incorrecta." });
  }
});

app.get('/api/articles', async (req, res) => {
  const articles = await getArticlesAsync();
  res.json(articles);
});

app.post('/api/articles', checkAuth, upload.single('imageFile'), async (req, res) => {
  const { title, subtitle, category, author, summary, content, image } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "El títol i el contingut són obligatoris." });
  }

  let finalImageUrl = image || '/expo_img/1688980723144.jpg';
  if (req.file) {
    finalImageUrl = `/uploads/${req.file.filename}`;
  }

  const articles = await getArticlesAsync();
  const newArticle = {
    id: 'art-' + Date.now(),
    title: title.trim(),
    subtitle: (subtitle || '').trim(),
    category: category || 'General',
    date: new Date().toISOString().split('T')[0],
    author: (author || 'Eva Miquel Tortosa').trim(),
    image: finalImageUrl,
    summary: (summary || content.substring(0, 140) + '...').trim(),
    content: content.trim()
  };

  articles.unshift(newArticle);
  await saveArticlesAsync(articles);
  res.status(201).json(newArticle);
});

app.delete('/api/articles/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  let articles = await getArticlesAsync();
  const initialLen = articles.length;
  articles = articles.filter(a => a.id !== id);

  if (articles.length < initialLen) {
    await saveArticlesAsync(articles);
    res.json({ success: true, message: "Article eliminat correctament." });
  } else {
    res.status(404).json({ error: "Article no trobat." });
  }
});

// Galeria d'imatges
app.get('/api/gallery', (req, res) => {
  fs.readdir(expoImgDir, (err, files) => {
    if (err) return res.status(500).json({ error: "No s'ha pogut carregar la galeria." });
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    
    const items = imageFiles.map((filename, idx) => ({
      id: `img-${idx + 1}`,
      title: `Vista / Obra #${idx + 1}`,
      url: `/expo_img/${filename}`,
      category: idx % 3 === 0 ? 'Dibuixos' : (idx % 2 === 0 ? 'Exposició' : 'Testimonis')
    }));

    res.json(items);
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor en marxa a: http://localhost:${PORT}`);
  });
}

module.exports = app;
