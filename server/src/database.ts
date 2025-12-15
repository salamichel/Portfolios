import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../data/portfolio.db');
const db = new Database(dbPath);

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS themes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    cover_image_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    theme_id TEXT,
    title TEXT,
    description TEXT,
    tags TEXT,
    mood TEXT,
    ai_enriched BOOLEAN DEFAULT FALSE,
    width INTEGER,
    height INTEGER,
    size INTEGER,
    mime_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_images_theme ON images(theme_id);
  CREATE INDEX IF NOT EXISTS idx_images_created ON images(created_at);
`);

export interface Theme {
  id: string;
  name: string;
  description: string | null;
  cover_image_id: string | null;
  created_at: string;
  updated_at: string;
  image_count?: number;
}

export interface Image {
  id: string;
  filename: string;
  original_name: string;
  theme_id: string | null;
  title: string | null;
  description: string | null;
  tags: string | null;
  mood: string | null;
  ai_enriched: boolean;
  width: number | null;
  height: number | null;
  size: number;
  mime_type: string;
  created_at: string;
  updated_at: string;
}

// Theme operations
export const themeDb = {
  getAll(): Theme[] {
    return db.prepare(`
      SELECT t.*, COUNT(i.id) as image_count
      FROM themes t
      LEFT JOIN images i ON t.id = i.theme_id
      GROUP BY t.id
      ORDER BY t.name
    `).all() as Theme[];
  },

  getById(id: string): Theme | undefined {
    return db.prepare('SELECT * FROM themes WHERE id = ?').get(id) as Theme | undefined;
  },

  create(theme: Omit<Theme, 'created_at' | 'updated_at' | 'image_count'>): Theme {
    db.prepare(`
      INSERT INTO themes (id, name, description, cover_image_id)
      VALUES (?, ?, ?, ?)
    `).run(theme.id, theme.name, theme.description, theme.cover_image_id);
    return this.getById(theme.id)!;
  },

  update(id: string, data: Partial<Theme>): Theme | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.cover_image_id !== undefined) { fields.push('cover_image_id = ?'); values.push(data.cover_image_id); }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE themes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM themes WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

// Image operations
export const imageDb = {
  getAll(options: { theme_id?: string; limit?: number; offset?: number; search?: string } = {}): { images: Image[]; total: number } {
    let whereClause = '1=1';
    const params: any[] = [];

    if (options.theme_id) {
      whereClause += ' AND theme_id = ?';
      params.push(options.theme_id);
    }

    if (options.search) {
      whereClause += ' AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)';
      const searchTerm = `%${options.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM images WHERE ${whereClause}`).get(...params) as { count: number };

    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const images = db.prepare(`
      SELECT * FROM images
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as Image[];

    return { images, total: total.count };
  },

  getById(id: string): Image | undefined {
    return db.prepare('SELECT * FROM images WHERE id = ?').get(id) as Image | undefined;
  },

  create(image: Omit<Image, 'created_at' | 'updated_at'>): Image {
    db.prepare(`
      INSERT INTO images (id, filename, original_name, theme_id, title, description, tags, mood, ai_enriched, width, height, size, mime_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      image.id, image.filename, image.original_name, image.theme_id,
      image.title, image.description, image.tags, image.mood, image.ai_enriched ? 1 : 0,
      image.width, image.height, image.size, image.mime_type
    );
    return this.getById(image.id)!;
  },

  update(id: string, data: Partial<Image>): Image | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.theme_id !== undefined) { fields.push('theme_id = ?'); values.push(data.theme_id); }
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.tags !== undefined) { fields.push('tags = ?'); values.push(data.tags); }
    if (data.mood !== undefined) { fields.push('mood = ?'); values.push(data.mood); }
    if (data.ai_enriched !== undefined) { fields.push('ai_enriched = ?'); values.push(data.ai_enriched ? 1 : 0); }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE images SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM images WHERE id = ?').run(id);
    return result.changes > 0;
  },

  getByTheme(themeId: string): Image[] {
    return db.prepare('SELECT * FROM images WHERE theme_id = ? ORDER BY created_at DESC').all(themeId) as Image[];
  }
};

export default db;
