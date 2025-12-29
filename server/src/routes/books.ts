import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { bookDb, bookPageDb, imageDb, templateDb } from '../database.js';
import { suggestBookLayout } from '../services/bookLayoutAI.js';

const router = Router();

// Get all books
router.get('/', (req, res) => {
  try {
    const books = bookDb.getAll();
    res.json(books);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// Get single book with pages
router.get('/:id', (req, res) => {
  try {
    const book = bookDb.getById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const pages = bookPageDb.getByBook(req.params.id);
    res.json({ ...book, pages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// Create book
router.post('/', (req, res) => {
  try {
    const { name, description, page_format, tags, mood, status } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Book name is required' });
    }

    const book = bookDb.create({
      id: uuidv4(),
      name: name.trim(),
      description: description?.trim() || null,
      cover_image_id: null,
      page_format: page_format || 'A4',
      tags: tags || null,
      mood: mood || null,
      status: status || 'draft'
    });

    res.status(201).json(book);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create book' });
  }
});

// Update book
router.put('/:id', (req, res) => {
  try {
    const { name, description, cover_image_id, page_format, tags, mood, status } = req.body;
    const book = bookDb.update(req.params.id, {
      name: name?.trim(),
      description: description?.trim(),
      cover_image_id,
      page_format,
      tags,
      mood,
      status
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json(book);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// Delete book
router.delete('/:id', (req, res) => {
  try {
    const deleted = bookDb.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// === Book Pages ===

// Add page to book
router.post('/:bookId/pages', (req, res) => {
  try {
    const book = bookDb.getById(req.params.bookId);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const { template_id, page_data, position } = req.body;

    const page = bookPageDb.create({
      id: uuidv4(),
      book_id: req.params.bookId,
      template_id: template_id || null,
      position: position ?? undefined,
      page_data: page_data || null
    });

    res.status(201).json(page);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create page' });
  }
});

// Update page
router.put('/:bookId/pages/:pageId', (req, res) => {
  try {
    const { template_id, page_data, position } = req.body;
    const page = bookPageDb.update(req.params.pageId, {
      template_id,
      page_data,
      position
    });

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json(page);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update page' });
  }
});

// Delete page
router.delete('/:bookId/pages/:pageId', (req, res) => {
  try {
    const deleted = bookPageDb.delete(req.params.pageId);
    if (!deleted) {
      return res.status(404).json({ error: 'Page not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

// Bulk delete pages
router.delete('/:bookId/pages', (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const deleted = bookPageDb.bulkDelete(req.params.bookId, ids);
    res.json({ deleted });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete pages' });
  }
});

// Reorder pages
router.put('/:bookId/pages/reorder', (req, res) => {
  try {
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ error: 'orderedIds array is required' });
    }

    bookPageDb.reorder(req.params.bookId, orderedIds);
    const pages = bookPageDb.getByBook(req.params.bookId);
    res.json(pages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder pages' });
  }
});

// === AI Layout Suggestions ===

// Get AI layout suggestions for selected images
router.post('/:bookId/suggest-layout', async (req, res) => {
  try {
    const { image_ids, use_cache = true } = req.body;

    if (!Array.isArray(image_ids) || image_ids.length === 0) {
      return res.status(400).json({ error: 'image_ids array is required' });
    }

    const images = imageDb.getByIds(image_ids);
    if (images.length === 0) {
      return res.status(404).json({ error: 'No images found' });
    }

    const templates = templateDb.getAll();
    const suggestions = await suggestBookLayout(images, templates, { useCache: use_cache });

    res.json(suggestions);
  } catch (error) {
    console.error('Layout suggestion error:', error);
    res.status(500).json({ error: 'Failed to generate layout suggestions' });
  }
});

// Apply AI suggestions to book (create pages from suggestions)
router.post('/:bookId/apply-suggestions', (req, res) => {
  try {
    const book = bookDb.getById(req.params.bookId);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const { suggestions } = req.body;

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return res.status(400).json({ error: 'suggestions array is required' });
    }

    const createdPages = [];
    for (const suggestion of suggestions) {
      const page = bookPageDb.create({
        id: uuidv4(),
        book_id: req.params.bookId,
        template_id: suggestion.template_id,
        position: suggestion.position ?? undefined,
        page_data: suggestion.page_data || null
      });
      createdPages.push(page);
    }

    res.status(201).json(createdPages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to apply suggestions' });
  }
});

export default router;
