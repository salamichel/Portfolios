import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { templateDb } from '../database.js';

const router = Router();

// Get all templates
router.get('/', (req, res) => {
  try {
    const templates = templateDb.getAll();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get single template
router.get('/:id', (req, res) => {
  try {
    const template = templateDb.getById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create custom template
router.post('/', (req, res) => {
  try {
    const { name, description, layout } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    if (!layout || !Array.isArray(layout.slots)) {
      return res.status(400).json({ error: 'Valid layout with slots is required' });
    }

    const template = templateDb.create({
      id: uuidv4(),
      name: name.trim(),
      description: description?.trim() || null,
      layout,
      is_predefined: false
    });

    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update custom template
router.put('/:id', (req, res) => {
  try {
    const existing = templateDb.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (existing.is_predefined) {
      return res.status(403).json({ error: 'Cannot modify predefined templates' });
    }

    const { name, description, layout } = req.body;
    const template = templateDb.update(req.params.id, {
      name: name?.trim(),
      description: description?.trim(),
      layout
    });

    res.json(template);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete custom template
router.delete('/:id', (req, res) => {
  try {
    const existing = templateDb.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (existing.is_predefined) {
      return res.status(403).json({ error: 'Cannot delete predefined templates' });
    }

    const deleted = templateDb.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
