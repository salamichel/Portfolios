import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { bookDb, bookPageDb, imageDb, templateDb, processingReportDb } from '../database.js';
import { suggestBookLayout } from '../services/bookLayoutAI.js';
import { generateBookPdf, getPdfPath, pdfExists, listBookPdfs, deletePdf, PDF_FORMATS, type PdfFormat } from '../services/pdfGenerator.js';

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
    const bookId = req.params.bookId;

    if (!Array.isArray(image_ids) || image_ids.length === 0) {
      return res.status(400).json({ error: 'image_ids array is required' });
    }

    const images = imageDb.getByIds(image_ids);
    if (images.length === 0) {
      return res.status(404).json({ error: 'No images found' });
    }

    const templates = templateDb.getAll();
    const suggestions = await suggestBookLayout(images, templates, {
      useCache: use_cache,
      bookId
    });

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

// === Processing Reports ===

// Get all processing reports for a book
router.get('/:bookId/reports', (req, res) => {
  try {
    const bookId = req.params.bookId;
    const book = bookDb.getById(bookId);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const reports = processingReportDb.getAll(bookId);
    res.json(reports);
  } catch (error) {
    console.error('Failed to get processing reports:', error);
    res.status(500).json({ error: 'Failed to get processing reports' });
  }
});

// Get latest processing report for a book
router.get('/:bookId/reports/latest', (req, res) => {
  try {
    const bookId = req.params.bookId;
    const book = bookDb.getById(bookId);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const report = processingReportDb.getLatestByBook(bookId);
    if (!report) {
      return res.status(404).json({ error: 'No reports found for this book' });
    }

    res.json(report);
  } catch (error) {
    console.error('Failed to get latest processing report:', error);
    res.status(500).json({ error: 'Failed to get latest processing report' });
  }
});

// Get specific processing report by ID
router.get('/:bookId/reports/:reportId', (req, res) => {
  try {
    const { bookId, reportId } = req.params;
    const book = bookDb.getById(bookId);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const report = processingReportDb.getById(reportId);
    if (!report || report.book_id !== bookId) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    console.error('Failed to get processing report:', error);
    res.status(500).json({ error: 'Failed to get processing report' });
  }
});

// === PDF Export ===

// Get available PDF formats
router.get('/pdf-formats', (req, res) => {
  const formats = Object.entries(PDF_FORMATS).map(([key, config]) => ({
    id: key,
    name: config.name,
    pageWidthCm: config.pageWidthCm,
    pageHeightCm: config.pageHeightCm,
  }));
  res.json(formats);
});

// Generate PDF for a book
router.post('/:id/export-pdf', async (req, res) => {
  try {
    const { format } = req.body;

    if (!format || !['landscape', 'portrait'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Must be "landscape" or "portrait"' });
    }

    const book = bookDb.getById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const pages = bookPageDb.getByBook(req.params.id);
    if (pages.length === 0) {
      return res.status(400).json({ error: 'Book has no pages' });
    }

    const result = await generateBookPdf({
      book,
      pages,
      format: format as PdfFormat,
    });

    res.json({
      success: true,
      filename: result.filename,
      size: result.size,
      downloadUrl: `/api/books/${req.params.id}/pdf/${result.filename}`,
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Download a generated PDF
router.get('/:id/pdf/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    if (!pdfExists(filename)) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const filepath = getPdfPath(filename);
    res.download(filepath, filename);
  } catch (error) {
    console.error('PDF download error:', error);
    res.status(500).json({ error: 'Failed to download PDF' });
  }
});

// List available PDFs for a book
router.get('/:id/pdfs', (req, res) => {
  try {
    const book = bookDb.getById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const pdfs = listBookPdfs(book.name);
    res.json(pdfs);
  } catch (error) {
    console.error('List PDFs error:', error);
    res.status(500).json({ error: 'Failed to list PDFs' });
  }
});

// Delete a generated PDF
router.delete('/:id/pdf/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    if (!pdfExists(filename)) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    deletePdf(filename);
    res.status(204).send();
  } catch (error) {
    console.error('PDF delete error:', error);
    res.status(500).json({ error: 'Failed to delete PDF' });
  }
});

export default router;
