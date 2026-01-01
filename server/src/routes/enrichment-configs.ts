import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { enrichmentConfigDb, GeminiModel } from '../database.js';

const router = Router();

const VALID_MODELS: GeminiModel[] = [
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-3-pro-preview'
];

// Get all enrichment configs
router.get('/', (req, res) => {
  try {
    const configs = enrichmentConfigDb.getAll();
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch enrichment configs' });
  }
});

// Get default enrichment config
router.get('/default', (req, res) => {
  try {
    const config = enrichmentConfigDb.getDefault();
    if (!config) {
      return res.status(404).json({ error: 'No default config found' });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch default config' });
  }
});

// Get available models
router.get('/models', (req, res) => {
  res.json(VALID_MODELS);
});

// Get single enrichment config
router.get('/:id', (req, res) => {
  try {
    const config = enrichmentConfigDb.getById(req.params.id);
    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// Create enrichment config
router.post('/', (req, res) => {
  try {
    const { name, prompt, model, is_default } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Config name is required' });
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!model || !VALID_MODELS.includes(model)) {
      return res.status(400).json({ error: `Invalid model. Valid models: ${VALID_MODELS.join(', ')}` });
    }

    const config = enrichmentConfigDb.create({
      id: uuidv4(),
      name: name.trim(),
      prompt: prompt.trim(),
      model,
      is_default: is_default || false
    });

    res.status(201).json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create config' });
  }
});

// Update enrichment config
router.put('/:id', (req, res) => {
  try {
    const { name, prompt, model, is_default } = req.body;

    if (model && !VALID_MODELS.includes(model)) {
      return res.status(400).json({ error: `Invalid model. Valid models: ${VALID_MODELS.join(', ')}` });
    }

    const config = enrichmentConfigDb.update(req.params.id, {
      name: name?.trim(),
      prompt: prompt?.trim(),
      model,
      is_default
    });

    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// Set config as default
router.post('/:id/set-default', (req, res) => {
  try {
    const config = enrichmentConfigDb.setDefault(req.params.id);
    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to set default config' });
  }
});

// Delete enrichment config
router.delete('/:id', (req, res) => {
  try {
    const deleted = enrichmentConfigDb.delete(req.params.id);
    if (!deleted) {
      return res.status(400).json({ error: 'Cannot delete config (it may be the only one)' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete config' });
  }
});

export default router;
