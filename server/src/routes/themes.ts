import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { themeDb, imageDb } from '../database.js';

const router = Router();

// Get all themes
router.get('/', (req, res) => {
  try {
    const themes = themeDb.getAll();
    res.json(themes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch themes' });
  }
});

// Get single theme with images
router.get('/:id', (req, res) => {
  try {
    const theme = themeDb.getById(req.params.id);
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    const images = imageDb.getByTheme(req.params.id);
    res.json({ ...theme, images });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch theme' });
  }
});

// Create theme
router.post('/', (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Theme name is required' });
    }

    const theme = themeDb.create({
      id: uuidv4(),
      name: name.trim(),
      description: description?.trim() || null,
      cover_image_id: null
    });

    res.status(201).json(theme);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create theme' });
  }
});

// Update theme
router.put('/:id', (req, res) => {
  try {
    const { name, description, cover_image_id } = req.body;
    const theme = themeDb.update(req.params.id, {
      name: name?.trim(),
      description: description?.trim(),
      cover_image_id
    });

    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    res.json(theme);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update theme' });
  }
});

// Delete theme
router.delete('/:id', (req, res) => {
  try {
    const deleted = themeDb.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete theme' });
  }
});

export default router;
