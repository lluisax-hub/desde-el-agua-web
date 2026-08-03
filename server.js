const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'eva';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Multer Storage (compatible amb Vercel Serverless)
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

// Helper llegir/escriure articles
function getArticles() {
  try {
    if (!fs.existsSync(dataFile)) return [];
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (err) {
    return [];
  }
}

function saveArticles(articles) {
  try {
    if (!process.env.VERCEL) {
      fs.writeFileSync(dataFile, JSON.stringify(articles, null, 2), 'utf8');
    }
    return true;
  } catch (err) {
    return false;
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

// REST API Endpoints
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD, message: "Accés concedit." });
  } else {
    res.status(401).json({ success: false, error: "Contrasenya incorrecta." });
  }
});

app.get('/api/articles', (req, res) => {
  res.json(getArticles());
});

app.post('/api/articles', checkAuth, upload.single('imageFile'), (req, res) => {
  const { title, subtitle, category, author, summary, content, image } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "El títol i el contingut són obligatoris." });
  }

  let finalImageUrl = image || '/expo_img/1688980723144.jpg';
  if (req.file) {
    finalImageUrl = `/uploads/${req.file.filename}`;
  }

  const articles = getArticles();
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
  saveArticles(articles);
  res.status(201).json(newArticle);
});

app.delete('/api/articles/:id', checkAuth, (req, res) => {
  const { id } = req.params;
  let articles = getArticles();
  const initialLen = articles.length;
  articles = articles.filter(a => a.id !== id);

  if (articles.length < initialLen) {
    saveArticles(articles);
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

// Només executar .listen en entorn local (no a Vercel Serverless)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor en marxa a: http://localhost:${PORT}`);
  });
}

// Exportar per a Vercel Serverless Functions
module.exports = app;
