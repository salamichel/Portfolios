import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Base directory (works in both dev and Docker)
const BASE_DIR = process.env.BASE_DIR || process.cwd();
const dataDir = path.join(BASE_DIR, 'data');

// Ensure data directory exists before opening database
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'portfolio.db');
const db = new Database(dbPath);

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS themes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    cover_image_id TEXT,
    position INTEGER DEFAULT 0,
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

  -- Page templates (predefined + custom layouts)
  CREATE TABLE IF NOT EXISTS page_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    layout TEXT NOT NULL,
    is_predefined BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Books
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    cover_image_id TEXT,
    page_format TEXT DEFAULT 'A4',
    tags TEXT,
    mood TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cover_image_id) REFERENCES images(id) ON DELETE SET NULL
  );

  -- Book pages (double-page spreads)
  CREATE TABLE IF NOT EXISTS book_pages (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    template_id TEXT,
    position INTEGER DEFAULT 0,
    page_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES page_templates(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_book_pages_book ON book_pages(book_id);
  CREATE INDEX IF NOT EXISTS idx_book_pages_position ON book_pages(position);

  -- Book processing reports (for AI layout generation tracking)
  CREATE TABLE IF NOT EXISTS book_processing_reports (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    image_count INTEGER,
    total_api_calls INTEGER DEFAULT 0,
    successful_api_calls INTEGER DEFAULT 0,
    failed_api_calls INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    error_message TEXT,
    api_calls_detail TEXT,
    cache_hit BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_processing_reports_book ON book_processing_reports(book_id);
  CREATE INDEX IF NOT EXISTS idx_processing_reports_status ON book_processing_reports(status);
  CREATE INDEX IF NOT EXISTS idx_processing_reports_started ON book_processing_reports(started_at);

  -- Image enrichment reports (for batch AI enrichment tracking)
  CREATE TABLE IF NOT EXISTS image_enrichment_reports (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    image_count INTEGER,
    total_api_calls INTEGER DEFAULT 0,
    successful_api_calls INTEGER DEFAULT 0,
    failed_api_calls INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    error_message TEXT,
    api_calls_detail TEXT,
    images_enriched INTEGER DEFAULT 0,
    images_failed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_enrichment_reports_status ON image_enrichment_reports(status);
  CREATE INDEX IF NOT EXISTS idx_enrichment_reports_started ON image_enrichment_reports(started_at);
`);

// Migration: Add position column if it doesn't exist (for existing databases)
try {
  db.exec(`ALTER TABLE themes ADD COLUMN position INTEGER DEFAULT 0`);
  // Initialize positions based on current order
  const themes = db.prepare('SELECT id FROM themes ORDER BY name').all() as { id: string }[];
  themes.forEach((theme, index) => {
    db.prepare('UPDATE themes SET position = ? WHERE id = ?').run(index, theme.id);
  });
} catch {
  // Column already exists, ignore error
}

// Migration: Add tags and mood columns to books if they don't exist
try {
  db.exec(`ALTER TABLE books ADD COLUMN tags TEXT`);
} catch {
  // Column already exists, ignore error
}

try {
  db.exec(`ALTER TABLE books ADD COLUMN mood TEXT`);
} catch {
  // Column already exists, ignore error
}

// Migration: Add category column to page_templates if it doesn't exist
try {
  db.exec(`ALTER TABLE page_templates ADD COLUMN category TEXT DEFAULT 'standard'`);
} catch {
  // Column already exists, ignore error
}

export interface Theme {
  id: string;
  name: string;
  description: string | null;
  cover_image_id: string | null;
  position: number;
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

// Layout slot definition for templates
export interface LayoutSlot {
  id: string;
  type: 'image' | 'text'; // Type of slot
  page: 'left' | 'right';
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
}

export interface TemplateLayout {
  slots: LayoutSlot[];
}

export type TemplateCategory = 'cover' | 'chapter' | 'standard' | 'gallery' | 'highlight' | 'narrative';

export interface PageTemplate {
  id: string;
  name: string;
  description: string | null;
  layout: TemplateLayout;
  category: TemplateCategory;
  is_predefined: boolean;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: string;
  name: string;
  description: string | null;
  cover_image_id: string | null;
  page_format: string;
  tags: string | null;
  mood: string | null;
  created_at: string;
  updated_at: string;
  page_count?: number;
}

// Page data stores image assignments to slots
export interface SlotAnnotation {
  title?: string;
  description?: string;
  paragraph?: string;
  show_title?: boolean;
  show_description?: boolean;
  show_paragraph?: boolean;
  position?: 'bottom' | 'top' | 'overlay' | 'side';
  use_image_metadata?: boolean; // Use AI-enriched metadata from image
}

export interface PageSlotData {
  slot_id: string;
  image_id: string;
  annotation?: SlotAnnotation;
}

// Text style options
export interface TextStyle {
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  fontFamily?: 'sans' | 'serif' | 'mono';
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  color?: string; // hex color
}

export interface TextSlotData {
  slot_id: string;
  content: string;
  style?: TextStyle;
}

export interface PageData {
  slots: PageSlotData[];
  textSlots?: TextSlotData[];
}

export interface BookPage {
  id: string;
  book_id: string;
  template_id: string | null;
  position: number;
  page_data: PageData | null;
  created_at: string;
  updated_at: string;
  template?: Partial<PageTemplate>;
  images?: Image[];
}

// API Call detail for tracking
export interface ApiCallDetail {
  timestamp: string;
  success: boolean;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  duration_ms: number;
  error?: string;
  retry_attempt?: number;
  prompt?: string; // The prompt sent to the AI
  response?: string; // The raw response from the AI
}

export type ProcessingStatus = 'processing' | 'success' | 'failed';

export interface BookProcessingReport {
  id: string;
  book_id: string;
  status: ProcessingStatus;
  started_at: string;
  completed_at: string | null;
  image_count: number;
  total_api_calls: number;
  successful_api_calls: number;
  failed_api_calls: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  execution_time_ms: number | null;
  error_message: string | null;
  api_calls_detail: ApiCallDetail[] | null;
  cache_hit: boolean;
  created_at: string;
  updated_at: string;
}

export interface ImageEnrichmentReport {
  id: string;
  status: ProcessingStatus;
  started_at: string;
  completed_at: string | null;
  image_count: number;
  total_api_calls: number;
  successful_api_calls: number;
  failed_api_calls: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  execution_time_ms: number | null;
  error_message: string | null;
  api_calls_detail: ApiCallDetail[] | null;
  images_enriched: number;
  images_failed: number;
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
      ORDER BY t.position, t.name
    `).all() as Theme[];
  },

  getById(id: string): Theme | undefined {
    return db.prepare('SELECT * FROM themes WHERE id = ?').get(id) as Theme | undefined;
  },

  getMaxPosition(): number {
    const result = db.prepare('SELECT MAX(position) as max_pos FROM themes').get() as { max_pos: number | null };
    return result.max_pos ?? -1;
  },

  create(theme: Omit<Theme, 'created_at' | 'updated_at' | 'image_count' | 'position'>): Theme {
    const position = this.getMaxPosition() + 1;
    db.prepare(`
      INSERT INTO themes (id, name, description, cover_image_id, position)
      VALUES (?, ?, ?, ?, ?)
    `).run(theme.id, theme.name, theme.description, theme.cover_image_id, position);
    return this.getById(theme.id)!;
  },

  update(id: string, data: Partial<Theme>): Theme | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.cover_image_id !== undefined) { fields.push('cover_image_id = ?'); values.push(data.cover_image_id); }
    if (data.position !== undefined) { fields.push('position = ?'); values.push(data.position); }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE themes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  reorder(orderedIds: string[]): void {
    const stmt = db.prepare('UPDATE themes SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const transaction = db.transaction((ids: string[]) => {
      ids.forEach((id, index) => {
        stmt.run(index, id);
      });
    });
    transaction(orderedIds);
  },

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM themes WHERE id = ?').run(id);
    return result.changes > 0;
  },

  bulkDelete(ids: string[]): number {
    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM themes WHERE id IN (${placeholders})`).run(...ids);
    return result.changes;
  }
};

// Image operations
export const imageDb = {
  getAll(options: { theme_id?: string; limit?: number; offset?: number; search?: string; tag?: string; mood?: string } = {}): { images: Image[]; total: number } {
    let whereClause = '1=1';
    const params: any[] = [];

    if (options.theme_id) {
      whereClause += ' AND theme_id = ?';
      params.push(options.theme_id);
    }

    if (options.search) {
      whereClause += ' AND (title LIKE ? OR description LIKE ? OR tags LIKE ? OR filename LIKE ? OR original_name LIKE ?)';
      const searchTerm = `%${options.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (options.tag) {
      whereClause += ' AND tags LIKE ?';
      params.push(`%${options.tag}%`);
    }

    if (options.mood) {
      whereClause += ' AND mood = ?';
      params.push(options.mood);
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
  },

  getByIds(ids: string[]): Image[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    return db.prepare(`SELECT * FROM images WHERE id IN (${placeholders})`).all(...ids) as Image[];
  },

  getTagsWithCounts(): Array<{ tag: string; count: number }> {
    try {
      const images = db.prepare("SELECT tags FROM images WHERE tags IS NOT NULL AND tags != ''").all() as { tags: string }[];
      const tagCounts = new Map<string, number>();

      images.forEach(image => {
        try {
          const tags = JSON.parse(image.tags);
          if (Array.isArray(tags)) {
            tags.forEach(tag => {
              if (tag && typeof tag === 'string') {
                tagCounts.set(tag.trim(), (tagCounts.get(tag.trim()) || 0) + 1);
              }
            });
          }
        } catch {
          // Try comma-separated format
          try {
            const tags = image.tags.split(',');
            tags.forEach(tag => {
              const trimmed = tag.trim();
              if (trimmed) {
                tagCounts.set(trimmed, (tagCounts.get(trimmed) || 0) + 1);
              }
            });
          } catch {
            // Skip invalid entries
          }
        }
      });

      return Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error('Error in getTagsWithCounts:', error);
      return [];
    }
  },

  getMoodsWithCounts(): Array<{ mood: string; count: number }> {
    try {
      const moods = db.prepare(`
        SELECT mood, COUNT(*) as count
        FROM images
        WHERE mood IS NOT NULL AND mood != ''
        GROUP BY mood
        ORDER BY count DESC
      `).all() as Array<{ mood: string; count: number }>;

      return moods;
    } catch (error) {
      console.error('Error in getMoodsWithCounts:', error);
      return [];
    }
  },

  getAllTags(): string[] {
    const images = db.prepare('SELECT tags FROM images WHERE tags IS NOT NULL').all() as { tags: string }[];
    const tagsSet = new Set<string>();

    for (const img of images) {
      try {
        const tags = JSON.parse(img.tags);
        if (Array.isArray(tags)) {
          tags.forEach(tag => {
            if (tag && typeof tag === 'string') {
              tagsSet.add(tag.trim());
            }
          });
        }
      } catch {
        // Try comma-separated format
        const tags = img.tags.split(',');
        tags.forEach(tag => {
          const trimmed = tag.trim();
          if (trimmed) {
            tagsSet.add(trimmed);
          }
        });
      }
    }

    return Array.from(tagsSet).sort();
  },

  getAllMoods(): string[] {
    const result = db.prepare(`
      SELECT DISTINCT mood
      FROM images
      WHERE mood IS NOT NULL AND mood != ''
      ORDER BY mood
    `).all() as { mood: string }[];

    return result.map(r => r.mood);
  },

  getUnenriched(): Image[] {
    return db.prepare(`
      SELECT * FROM images
      WHERE ai_enriched = 0 OR ai_enriched IS NULL
      ORDER BY created_at DESC
    `).all() as Image[];
  },

  countUnenriched(): number {
    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM images
      WHERE ai_enriched = 0 OR ai_enriched IS NULL
    `).get() as { count: number };
    return result.count;
  }
};

// Page template operations
export const templateDb = {
  getAll(): PageTemplate[] {
    const templates = db.prepare('SELECT * FROM page_templates ORDER BY is_predefined DESC, name').all() as any[];
    return templates.map(t => ({
      ...t,
      layout: JSON.parse(t.layout),
      is_predefined: Boolean(t.is_predefined)
    }));
  },

  getById(id: string): PageTemplate | undefined {
    const template = db.prepare('SELECT * FROM page_templates WHERE id = ?').get(id) as any;
    if (!template) return undefined;
    return {
      ...template,
      layout: JSON.parse(template.layout),
      is_predefined: Boolean(template.is_predefined)
    };
  },

  create(template: Omit<PageTemplate, 'created_at' | 'updated_at'>): PageTemplate {
    db.prepare(`
      INSERT INTO page_templates (id, name, description, layout, category, is_predefined)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      template.id,
      template.name,
      template.description,
      JSON.stringify(template.layout),
      template.category || 'standard',
      template.is_predefined ? 1 : 0
    );
    return this.getById(template.id)!;
  },

  update(id: string, data: Partial<Omit<PageTemplate, 'id' | 'created_at' | 'updated_at'>>): PageTemplate | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.layout !== undefined) { fields.push('layout = ?'); values.push(JSON.stringify(data.layout)); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE page_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM page_templates WHERE id = ? AND is_predefined = 0').run(id);
    return result.changes > 0;
  },

  resetPredefined(): void {
    // Delete all predefined templates and recreate them
    db.prepare('DELETE FROM page_templates WHERE is_predefined = 1').run();
    this.initPredefined();
  },

  initPredefined(): void {
    const existing = db.prepare('SELECT COUNT(*) as count FROM page_templates WHERE is_predefined = 1').get() as { count: number };
    if (existing.count > 0) return;

    const predefinedTemplates: Omit<PageTemplate, 'created_at' | 'updated_at'>[] = [
      {
        id: 'tpl-full-bleed-2',
        name: 'Pleine page x2',
        description: 'Une image pleine page de chaque côté',
        category: 'standard',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'left-full', type: 'image', page: 'left', x: 0, y: 0, width: 100, height: 100 },
            { id: 'right-full', type: 'image', page: 'right', x: 0, y: 0, width: 100, height: 100 }
          ]
        }
      },
      {
        id: 'tpl-single-left',
        name: 'Image gauche seule',
        description: 'Une seule grande image à gauche, page droite vide',
        category: 'highlight',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'left-full', type: 'image', page: 'left', x: 0, y: 0, width: 100, height: 100 }
          ]
        }
      },
      {
        id: 'tpl-single-right',
        name: 'Image droite seule',
        description: 'Page gauche vide, une seule grande image à droite',
        category: 'highlight',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'right-full', type: 'image', page: 'right', x: 0, y: 0, width: 100, height: 100 }
          ]
        }
      },
      {
        id: 'tpl-grid-2x2',
        name: 'Grille 2x2',
        description: 'Quatre images réparties sur les deux pages en pleine page',
        category: 'gallery',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'left-top', type: 'image', page: 'left', x: 0, y: 0, width: 100, height: 49 },
            { id: 'left-bottom', type: 'image', page: 'left', x: 0, y: 51, width: 100, height: 49 },
            { id: 'right-top', type: 'image', page: 'right', x: 0, y: 0, width: 100, height: 49 },
            { id: 'right-bottom', type: 'image', page: 'right', x: 0, y: 51, width: 100, height: 49 }
          ]
        }
      },
      {
        id: 'tpl-1-large-2-small',
        name: '1 grande + 2 petites',
        description: 'Une grande image à gauche, deux petites empilées à droite',
        category: 'standard',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'left-full', type: 'image', page: 'left', x: 0, y: 0, width: 100, height: 100 },
            { id: 'right-top', type: 'image', page: 'right', x: 5, y: 5, width: 90, height: 45 },
            { id: 'right-bottom', type: 'image', page: 'right', x: 5, y: 52, width: 90, height: 43 }
          ]
        }
      },
      {
        id: 'tpl-2-small-1-large',
        name: '2 petites + 1 grande',
        description: 'Deux petites images empilées à gauche, une grande à droite',
        category: 'standard',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'left-top', type: 'image', page: 'left', x: 5, y: 5, width: 90, height: 45 },
            { id: 'left-bottom', type: 'image', page: 'left', x: 5, y: 52, width: 90, height: 43 },
            { id: 'right-full', type: 'image', page: 'right', x: 0, y: 0, width: 100, height: 100 }
          ]
        }
      },
      {
        id: 'tpl-panoramic',
        name: 'Panoramique',
        description: 'Une image qui s\'étend sur les deux pages',
        category: 'highlight',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'panoramic', type: 'image', page: 'left', x: 0, y: 20, width: 200, height: 60 }
          ]
        }
      },
      {
        id: 'tpl-grid-3',
        name: 'Triptyque',
        description: 'Trois images en bande horizontale',
        category: 'gallery',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'left-img', type: 'image', page: 'left', x: 5, y: 25, width: 90, height: 50 },
            { id: 'center-img', type: 'image', page: 'right', x: 5, y: 25, width: 45, height: 50 },
            { id: 'right-img', type: 'image', page: 'right', x: 52, y: 25, width: 43, height: 50 }
          ]
        }
      },
      {
        id: 'tpl-mosaic-5',
        name: 'Mosaïque 5 images',
        description: 'Cinq images en disposition mosaïque',
        category: 'gallery',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'left-large', type: 'image', page: 'left', x: 5, y: 5, width: 60, height: 60 },
            { id: 'left-small-1', type: 'image', page: 'left', x: 67, y: 5, width: 28, height: 28 },
            { id: 'left-small-2', type: 'image', page: 'left', x: 67, y: 35, width: 28, height: 30 },
            { id: 'right-top', type: 'image', page: 'right', x: 5, y: 5, width: 90, height: 45 },
            { id: 'right-bottom', type: 'image', page: 'right', x: 5, y: 52, width: 90, height: 43 }
          ]
        }
      },
      {
        id: 'tpl-centered-single',
        name: 'Centré unique',
        description: 'Une seule image centrée sur la double page',
        category: 'highlight',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'centered', type: 'image', page: 'left', x: 25, y: 15, width: 150, height: 70 }
          ]
        }
      },
      // Templates avec zones de texte
      {
        id: 'tpl-image-text-right',
        name: 'Image + Texte droite',
        description: 'Une image à gauche avec une zone de texte à droite',
        category: 'narrative',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'left-full', type: 'image', page: 'left', x: 0, y: 0, width: 100, height: 100 },
            { id: 'right-text', type: 'text', page: 'right', x: 10, y: 20, width: 80, height: 60 }
          ]
        }
      },
      {
        id: 'tpl-text-image-left',
        name: 'Texte + Image gauche',
        description: 'Une zone de texte à gauche avec une image à droite',
        category: 'narrative',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'left-text', type: 'text', page: 'left', x: 10, y: 20, width: 80, height: 60 },
            { id: 'right-full', type: 'image', page: 'right', x: 0, y: 0, width: 100, height: 100 }
          ]
        }
      },
      {
        id: 'tpl-images-caption',
        name: 'Images + Légende',
        description: 'Deux images avec une zone de légende en bas',
        category: 'narrative',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'left-img', type: 'image', page: 'left', x: 5, y: 5, width: 90, height: 70 },
            { id: 'right-img', type: 'image', page: 'right', x: 5, y: 5, width: 90, height: 70 },
            { id: 'caption', type: 'text', page: 'left', x: 5, y: 78, width: 190, height: 17 }
          ]
        }
      },
      {
        id: 'tpl-title-image',
        name: 'Titre + Image',
        description: 'Une zone de titre en haut avec une grande image',
        category: 'chapter',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'title', type: 'text', page: 'left', x: 10, y: 5, width: 180, height: 15 },
            { id: 'main-image', type: 'image', page: 'left', x: 10, y: 22, width: 180, height: 73 }
          ]
        }
      },
      {
        id: 'tpl-chapter-intro',
        name: 'Introduction chapitre',
        description: 'Page de titre de chapitre avec texte d\'introduction',
        category: 'chapter',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'chapter-title', type: 'text', page: 'left', x: 15, y: 30, width: 70, height: 40 },
            { id: 'chapter-image', type: 'image', page: 'right', x: 0, y: 0, width: 100, height: 100 }
          ]
        }
      },
      {
        id: 'tpl-gallery-text',
        name: 'Galerie + Texte',
        description: 'Trois images à gauche avec texte descriptif à droite',
        category: 'narrative',
        is_predefined: true,
        layout: {
          slots: [
            { id: 'img-1', type: 'image', page: 'left', x: 5, y: 5, width: 90, height: 30 },
            { id: 'img-2', type: 'image', page: 'left', x: 5, y: 37, width: 90, height: 30 },
            { id: 'img-3', type: 'image', page: 'left', x: 5, y: 69, width: 90, height: 26 },
            { id: 'description', type: 'text', page: 'right', x: 10, y: 15, width: 80, height: 70 }
          ]
        }
      },
      // Templates Zig Zag
      {
        id: 'tpl-zigzag-3-rows',
        name: 'Zig Zag 3 lignes',
        description: 'Trois lignes alternées : image gauche/texte droite, texte gauche/image droite, image gauche/texte droite',
        is_predefined: true,
        category: 'narrative',
        layout: {
          slots: [
            // Ligne 1: image gauche, texte droite
            { id: 'img-1', type: 'image', page: 'left', x: 5, y: 3, width: 90, height: 30 },
            { id: 'text-1', type: 'text', page: 'right', x: 10, y: 5, width: 80, height: 26 },
            // Ligne 2: texte gauche, image droite
            { id: 'text-2', type: 'text', page: 'left', x: 10, y: 37, width: 80, height: 26 },
            { id: 'img-2', type: 'image', page: 'right', x: 5, y: 35, width: 90, height: 30 },
            // Ligne 3: image gauche, texte droite
            { id: 'img-3', type: 'image', page: 'left', x: 5, y: 69, width: 90, height: 28 },
            { id: 'text-3', type: 'text', page: 'right', x: 10, y: 71, width: 80, height: 24 }
          ]
        }
      },
      {
        id: 'tpl-zigzag-3-reverse',
        name: 'Zig Zag 3 lignes inversé',
        description: 'Trois lignes alternées : texte gauche/image droite, image gauche/texte droite, texte gauche/image droite',
        is_predefined: true,
        category: 'narrative',
        layout: {
          slots: [
            // Ligne 1: texte gauche, image droite
            { id: 'text-1', type: 'text', page: 'left', x: 10, y: 5, width: 80, height: 26 },
            { id: 'img-1', type: 'image', page: 'right', x: 5, y: 3, width: 90, height: 30 },
            // Ligne 2: image gauche, texte droite
            { id: 'img-2', type: 'image', page: 'left', x: 5, y: 35, width: 90, height: 30 },
            { id: 'text-2', type: 'text', page: 'right', x: 10, y: 37, width: 80, height: 26 },
            // Ligne 3: texte gauche, image droite
            { id: 'text-3', type: 'text', page: 'left', x: 10, y: 71, width: 80, height: 24 },
            { id: 'img-3', type: 'image', page: 'right', x: 5, y: 69, width: 90, height: 28 }
          ]
        }
      }
    ];

    for (const template of predefinedTemplates) {
      this.create(template);
    }
  }
};

// Book operations
export const bookDb = {
  getAll(): Book[] {
    return db.prepare(`
      SELECT b.*, COUNT(bp.id) as page_count
      FROM books b
      LEFT JOIN book_pages bp ON b.id = bp.book_id
      GROUP BY b.id
      ORDER BY b.updated_at DESC
    `).all() as Book[];
  },

  getById(id: string): Book | undefined {
    const book = db.prepare(`
      SELECT b.*, COUNT(bp.id) as page_count
      FROM books b
      LEFT JOIN book_pages bp ON b.id = bp.book_id
      WHERE b.id = ?
      GROUP BY b.id
    `).get(id) as Book | undefined;
    return book;
  },

  create(book: Omit<Book, 'created_at' | 'updated_at' | 'page_count'>): Book {
    db.prepare(`
      INSERT INTO books (id, name, description, cover_image_id, page_format, tags, mood)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(book.id, book.name, book.description, book.cover_image_id, book.page_format, book.tags, book.mood);
    return this.getById(book.id)!;
  },

  update(id: string, data: Partial<Omit<Book, 'id' | 'created_at' | 'updated_at' | 'page_count'>>): Book | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.cover_image_id !== undefined) { fields.push('cover_image_id = ?'); values.push(data.cover_image_id); }
    if (data.page_format !== undefined) { fields.push('page_format = ?'); values.push(data.page_format); }
    if (data.tags !== undefined) { fields.push('tags = ?'); values.push(data.tags); }
    if (data.mood !== undefined) { fields.push('mood = ?'); values.push(data.mood); }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE books SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM books WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

// Book page operations
export const bookPageDb = {
  getByBook(bookId: string): BookPage[] {
    const pages = db.prepare(`
      SELECT bp.*, pt.name as template_name, pt.layout as template_layout
      FROM book_pages bp
      LEFT JOIN page_templates pt ON bp.template_id = pt.id
      WHERE bp.book_id = ?
      ORDER BY bp.position
    `).all(bookId) as any[];

    return pages.map(p => {
      const pageData = p.page_data ? JSON.parse(p.page_data) : null;
      const template = p.template_id ? {
        id: p.template_id,
        name: p.template_name,
        layout: JSON.parse(p.template_layout)
      } : undefined;

      // Get images for this page
      const imageIds = pageData?.slots?.map((s: PageSlotData) => s.image_id) || [];
      const images = imageIds.length > 0 ? imageDb.getByIds(imageIds) : [];

      return {
        id: p.id,
        book_id: p.book_id,
        template_id: p.template_id,
        position: p.position,
        page_data: pageData,
        created_at: p.created_at,
        updated_at: p.updated_at,
        template,
        images
      };
    });
  },

  getById(id: string): BookPage | undefined {
    const page = db.prepare(`
      SELECT bp.*, pt.name as template_name, pt.layout as template_layout
      FROM book_pages bp
      LEFT JOIN page_templates pt ON bp.template_id = pt.id
      WHERE bp.id = ?
    `).get(id) as any;

    if (!page) return undefined;

    const pageData = page.page_data ? JSON.parse(page.page_data) : null;
    const template = page.template_id ? {
      id: page.template_id,
      name: page.template_name,
      layout: JSON.parse(page.template_layout)
    } : undefined;

    const imageIds = pageData?.slots?.map((s: PageSlotData) => s.image_id) || [];
    const images = imageIds.length > 0 ? imageDb.getByIds(imageIds) : [];

    return {
      id: page.id,
      book_id: page.book_id,
      template_id: page.template_id,
      position: page.position,
      page_data: pageData,
      created_at: page.created_at,
      updated_at: page.updated_at,
      template,
      images
    };
  },

  getMaxPosition(bookId: string): number {
    const result = db.prepare('SELECT MAX(position) as max_pos FROM book_pages WHERE book_id = ?').get(bookId) as { max_pos: number | null };
    return result.max_pos ?? -1;
  },

  create(page: Omit<BookPage, 'created_at' | 'updated_at' | 'template' | 'images'>): BookPage {
    const position = page.position ?? this.getMaxPosition(page.book_id) + 1;
    db.prepare(`
      INSERT INTO book_pages (id, book_id, template_id, position, page_data)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      page.id,
      page.book_id,
      page.template_id,
      position,
      page.page_data ? JSON.stringify(page.page_data) : null
    );
    return this.getById(page.id)!;
  },

  update(id: string, data: Partial<Omit<BookPage, 'id' | 'book_id' | 'created_at' | 'updated_at' | 'template' | 'images'>>): BookPage | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.template_id !== undefined) { fields.push('template_id = ?'); values.push(data.template_id); }
    if (data.position !== undefined) { fields.push('position = ?'); values.push(data.position); }
    if (data.page_data !== undefined) { fields.push('page_data = ?'); values.push(JSON.stringify(data.page_data)); }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE book_pages SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM book_pages WHERE id = ?').run(id);
    return result.changes > 0;
  },

  bulkDelete(bookId: string, ids: string[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(`DELETE FROM book_pages WHERE book_id = ? AND id IN (${placeholders})`).run(bookId, ...ids);
    return result.changes;
  },

  reorder(bookId: string, orderedIds: string[]): void {
    const stmt = db.prepare('UPDATE book_pages SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND book_id = ?');
    const transaction = db.transaction((ids: string[]) => {
      ids.forEach((id, index) => {
        stmt.run(index, id, bookId);
      });
    });
    transaction(orderedIds);
  }
};

// Book processing report operations
export const processingReportDb = {
  getAll(bookId?: string): BookProcessingReport[] {
    const query = bookId
      ? 'SELECT * FROM book_processing_reports WHERE book_id = ? ORDER BY started_at DESC'
      : 'SELECT * FROM book_processing_reports ORDER BY started_at DESC';

    const reports = bookId
      ? db.prepare(query).all(bookId) as any[]
      : db.prepare(query).all() as any[];

    return reports.map(r => ({
      ...r,
      api_calls_detail: r.api_calls_detail ? JSON.parse(r.api_calls_detail) : null,
      cache_hit: Boolean(r.cache_hit)
    }));
  },

  getById(id: string): BookProcessingReport | undefined {
    const report = db.prepare('SELECT * FROM book_processing_reports WHERE id = ?').get(id) as any;
    if (!report) return undefined;

    return {
      ...report,
      api_calls_detail: report.api_calls_detail ? JSON.parse(report.api_calls_detail) : null,
      cache_hit: Boolean(report.cache_hit)
    };
  },

  getLatestByBook(bookId: string): BookProcessingReport | undefined {
    const report = db.prepare(`
      SELECT * FROM book_processing_reports
      WHERE book_id = ?
      ORDER BY started_at DESC
      LIMIT 1
    `).get(bookId) as any;

    if (!report) return undefined;

    return {
      ...report,
      api_calls_detail: report.api_calls_detail ? JSON.parse(report.api_calls_detail) : null,
      cache_hit: Boolean(report.cache_hit)
    };
  },

  create(report: Omit<BookProcessingReport, 'created_at' | 'updated_at'>): BookProcessingReport {
    db.prepare(`
      INSERT INTO book_processing_reports (
        id, book_id, status, started_at, completed_at, image_count,
        total_api_calls, successful_api_calls, failed_api_calls,
        total_tokens, prompt_tokens, completion_tokens,
        execution_time_ms, error_message, api_calls_detail, cache_hit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      report.id,
      report.book_id,
      report.status,
      report.started_at,
      report.completed_at,
      report.image_count,
      report.total_api_calls,
      report.successful_api_calls,
      report.failed_api_calls,
      report.total_tokens,
      report.prompt_tokens,
      report.completion_tokens,
      report.execution_time_ms,
      report.error_message,
      report.api_calls_detail ? JSON.stringify(report.api_calls_detail) : null,
      report.cache_hit ? 1 : 0
    );
    return this.getById(report.id)!;
  },

  update(id: string, data: Partial<Omit<BookProcessingReport, 'id' | 'book_id' | 'created_at' | 'updated_at'>>): BookProcessingReport | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.completed_at !== undefined) { fields.push('completed_at = ?'); values.push(data.completed_at); }
    if (data.image_count !== undefined) { fields.push('image_count = ?'); values.push(data.image_count); }
    if (data.total_api_calls !== undefined) { fields.push('total_api_calls = ?'); values.push(data.total_api_calls); }
    if (data.successful_api_calls !== undefined) { fields.push('successful_api_calls = ?'); values.push(data.successful_api_calls); }
    if (data.failed_api_calls !== undefined) { fields.push('failed_api_calls = ?'); values.push(data.failed_api_calls); }
    if (data.total_tokens !== undefined) { fields.push('total_tokens = ?'); values.push(data.total_tokens); }
    if (data.prompt_tokens !== undefined) { fields.push('prompt_tokens = ?'); values.push(data.prompt_tokens); }
    if (data.completion_tokens !== undefined) { fields.push('completion_tokens = ?'); values.push(data.completion_tokens); }
    if (data.execution_time_ms !== undefined) { fields.push('execution_time_ms = ?'); values.push(data.execution_time_ms); }
    if (data.error_message !== undefined) { fields.push('error_message = ?'); values.push(data.error_message); }
    if (data.api_calls_detail !== undefined) { fields.push('api_calls_detail = ?'); values.push(JSON.stringify(data.api_calls_detail)); }
    if (data.cache_hit !== undefined) { fields.push('cache_hit = ?'); values.push(data.cache_hit ? 1 : 0); }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE book_processing_reports SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM book_processing_reports WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

export const enrichmentReportDb = {
  getAll(): ImageEnrichmentReport[] {
    const reports = db.prepare('SELECT * FROM image_enrichment_reports ORDER BY started_at DESC').all() as any[];
    return reports.map(r => ({
      ...r,
      api_calls_detail: r.api_calls_detail ? JSON.parse(r.api_calls_detail) : null
    }));
  },

  getById(id: string): ImageEnrichmentReport | undefined {
    const report = db.prepare('SELECT * FROM image_enrichment_reports WHERE id = ?').get(id) as any;
    if (!report) return undefined;
    return {
      ...report,
      api_calls_detail: report.api_calls_detail ? JSON.parse(report.api_calls_detail) : null
    };
  },

  getLatest(): ImageEnrichmentReport | undefined {
    const report = db.prepare(`
      SELECT * FROM image_enrichment_reports
      ORDER BY started_at DESC
      LIMIT 1
    `).get() as any;

    if (!report) return undefined;
    return {
      ...report,
      api_calls_detail: report.api_calls_detail ? JSON.parse(report.api_calls_detail) : null
    };
  },

  create(report: Omit<ImageEnrichmentReport, 'created_at' | 'updated_at'>): ImageEnrichmentReport {
    db.prepare(`
      INSERT INTO image_enrichment_reports (
        id, status, started_at, completed_at, image_count,
        total_api_calls, successful_api_calls, failed_api_calls,
        total_tokens, prompt_tokens, completion_tokens,
        execution_time_ms, error_message, api_calls_detail,
        images_enriched, images_failed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      report.id,
      report.status,
      report.started_at,
      report.completed_at,
      report.image_count,
      report.total_api_calls,
      report.successful_api_calls,
      report.failed_api_calls,
      report.total_tokens,
      report.prompt_tokens,
      report.completion_tokens,
      report.execution_time_ms,
      report.error_message,
      report.api_calls_detail ? JSON.stringify(report.api_calls_detail) : null,
      report.images_enriched,
      report.images_failed
    );
    return this.getById(report.id)!;
  },

  update(id: string, data: Partial<Omit<ImageEnrichmentReport, 'id' | 'created_at' | 'updated_at'>>): ImageEnrichmentReport | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.completed_at !== undefined) { fields.push('completed_at = ?'); values.push(data.completed_at); }
    if (data.image_count !== undefined) { fields.push('image_count = ?'); values.push(data.image_count); }
    if (data.total_api_calls !== undefined) { fields.push('total_api_calls = ?'); values.push(data.total_api_calls); }
    if (data.successful_api_calls !== undefined) { fields.push('successful_api_calls = ?'); values.push(data.successful_api_calls); }
    if (data.failed_api_calls !== undefined) { fields.push('failed_api_calls = ?'); values.push(data.failed_api_calls); }
    if (data.total_tokens !== undefined) { fields.push('total_tokens = ?'); values.push(data.total_tokens); }
    if (data.prompt_tokens !== undefined) { fields.push('prompt_tokens = ?'); values.push(data.prompt_tokens); }
    if (data.completion_tokens !== undefined) { fields.push('completion_tokens = ?'); values.push(data.completion_tokens); }
    if (data.execution_time_ms !== undefined) { fields.push('execution_time_ms = ?'); values.push(data.execution_time_ms); }
    if (data.error_message !== undefined) { fields.push('error_message = ?'); values.push(data.error_message); }
    if (data.api_calls_detail !== undefined) { fields.push('api_calls_detail = ?'); values.push(JSON.stringify(data.api_calls_detail)); }
    if (data.images_enriched !== undefined) { fields.push('images_enriched = ?'); values.push(data.images_enriched); }
    if (data.images_failed !== undefined) { fields.push('images_failed = ?'); values.push(data.images_failed); }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE image_enrichment_reports SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM image_enrichment_reports WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

// Initialize predefined templates
templateDb.initPredefined();

export default db;
