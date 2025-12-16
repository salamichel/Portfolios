import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import themesRouter from './routes/themes.js';
import imagesRouter from './routes/images.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Base directory (works in both dev and Docker)
const BASE_DIR = process.env.BASE_DIR || process.cwd();
const uploadsDir = path.join(BASE_DIR, 'uploads');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
const optimizedDir = path.join(uploadsDir, 'optimized');
const dataDir = path.join(BASE_DIR, 'data');

// Ensure directories exist
[uploadsDir, thumbnailsDir, optimizedDir, dataDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded images statically
app.use('/uploads', express.static(uploadsDir));
app.use('/thumbnails', express.static(thumbnailsDir));
app.use('/optimized', express.static(optimizedDir));

// API Routes
app.use('/api/themes', themesRouter);
app.use('/api/images', imagesRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
