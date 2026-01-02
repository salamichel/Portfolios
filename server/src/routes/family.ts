import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import { familyMemberDb, trainingImageDb, imagePeopleDb, imageDb, FamilyMember, TrainingImage, ImagePerson } from '../database.js';
import { recognizePeople, recognizePeopleBatch } from '../services/gemini.js';

const router = Router();

// Setup training image directories
const BASE_DIR = process.env.BASE_DIR || process.cwd();
const uploadsDir = path.join(BASE_DIR, 'uploads');
const trainingDir = path.join(uploadsDir, 'training');
const trainingThumbsDir = path.join(trainingDir, 'thumbnails');

// Ensure directories exist
[trainingDir, trainingThumbsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for training image uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, trainingDir),
    filename: (req, file, cb) => {
      const uniqueId = uuidv4();
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueId}${ext}`);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

// Get all family members
router.get('/members', (req, res) => {
  try {
    const members = familyMemberDb.getAll();

    // Add training image count to each member
    const membersWithCounts = members.map(member => ({
      ...member,
      training_image_count: familyMemberDb.getTrainingImageCount(member.id)
    }));

    res.json(membersWithCounts);
  } catch (error) {
    console.error('Error fetching family members:', error);
    res.status(500).json({ error: 'Failed to fetch family members' });
  }
});

// Get a single family member
router.get('/members/:id', (req, res) => {
  try {
    const member = familyMemberDb.getById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    const training_image_count = familyMemberDb.getTrainingImageCount(member.id);
    res.json({ ...member, training_image_count });
  } catch (error) {
    console.error('Error fetching family member:', error);
    res.status(500).json({ error: 'Failed to fetch family member' });
  }
});

// Create a new family member
router.post('/members', (req, res) => {
  try {
    const { name, relationship, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const member: Omit<FamilyMember, 'created_at' | 'updated_at'> = {
      id: uuidv4(),
      name,
      relationship: relationship || null,
      notes: notes || null
    };

    const created = familyMemberDb.create(member);
    res.status(201).json({
      ...created,
      training_image_count: 0
    });
  } catch (error) {
    console.error('Error creating family member:', error);
    res.status(500).json({ error: 'Failed to create family member' });
  }
});

// Update a family member
router.put('/members/:id', (req, res) => {
  try {
    const { name, relationship, notes } = req.body;

    const existing = familyMemberDb.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    const updates: Partial<Omit<FamilyMember, 'id' | 'created_at' | 'updated_at'>> = {};
    if (name !== undefined) updates.name = name;
    if (relationship !== undefined) updates.relationship = relationship;
    if (notes !== undefined) updates.notes = notes;

    const updated = familyMemberDb.update(req.params.id, updates);
    res.json({
      ...updated,
      training_image_count: familyMemberDb.getTrainingImageCount(req.params.id)
    });
  } catch (error) {
    console.error('Error updating family member:', error);
    res.status(500).json({ error: 'Failed to update family member' });
  }
});

// Delete a family member
router.delete('/members/:id', (req, res) => {
  try {
    const deleted = familyMemberDb.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Family member not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting family member:', error);
    res.status(500).json({ error: 'Failed to delete family member' });
  }
});

// Get training images for a member
router.get('/members/:id/training-images', (req, res) => {
  try {
    const trainingImages = trainingImageDb.getByMemberId(req.params.id);
    res.json(trainingImages);
  } catch (error) {
    console.error('Error fetching training images:', error);
    res.status(500).json({ error: 'Failed to fetch training images' });
  }
});

// Upload training images for a member
router.post('/training-images/upload', upload.array('images', 10), async (req, res) => {
  try {
    const { family_member_id } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!family_member_id) {
      return res.status(400).json({ error: 'family_member_id is required' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    // Verify family member exists
    const member = familyMemberDb.getById(family_member_id);
    if (!member) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    const createdTrainingImages: TrainingImage[] = [];

    // Process each uploaded file
    for (const file of files) {
      try {
        const filenameWithoutExt = path.parse(file.filename).name;
        const webpFilename = `${filenameWithoutExt}.webp`;
        const webpPath = path.join(trainingDir, webpFilename);
        const thumbPath = path.join(trainingThumbsDir, `thumb_${webpFilename}`);

        // Convert to WebP
        await sharp(file.path)
          .webp({ quality: 90 })
          .toFile(webpPath);

        // Create thumbnail
        await sharp(file.path)
          .resize(400, 400, { fit: 'cover' })
          .webp({ quality: 80 })
          .toFile(thumbPath);

        // Delete original file if not WebP
        if (path.extname(file.filename).toLowerCase() !== '.webp') {
          fs.unlinkSync(file.path);
        }

        // Save to database
        const training: Omit<TrainingImage, 'created_at'> = {
          id: uuidv4(),
          filename: filenameWithoutExt,
          original_name: file.originalname,
          family_member_id,
          size: file.size,
          mime_type: file.mimetype,
          bounding_box: null,
          verified: false
        };

        const created = trainingImageDb.create(training);
        createdTrainingImages.push(created);
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
      }
    }

    res.status(201).json(createdTrainingImages);
  } catch (error) {
    console.error('Error uploading training images:', error);
    res.status(500).json({ error: 'Failed to upload training images' });
  }
});

// Update a training image
router.put('/training-images/:id', (req, res) => {
  try {
    const { bounding_box, verified } = req.body;

    const existing = trainingImageDb.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Training image not found' });
    }

    const updates: Partial<Omit<TrainingImage, 'id' | 'created_at'>> = {};
    if (bounding_box !== undefined) updates.bounding_box = JSON.stringify(bounding_box);
    if (verified !== undefined) updates.verified = verified;

    const updated = trainingImageDb.update(req.params.id, updates);
    res.json(updated);
  } catch (error) {
    console.error('Error updating training image:', error);
    res.status(500).json({ error: 'Failed to update training image' });
  }
});

// Delete a training image
router.delete('/training-images/:id', (req, res) => {
  try {
    const existing = trainingImageDb.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Training image not found' });
    }

    // Delete files from disk
    const webpPath = path.join(trainingDir, `${existing.filename}.webp`);
    const thumbPath = path.join(trainingThumbsDir, `thumb_${existing.filename}.webp`);

    if (fs.existsSync(webpPath)) {
      fs.unlinkSync(webpPath);
    }
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }

    // Delete from database
    trainingImageDb.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting training image:', error);
    res.status(500).json({ error: 'Failed to delete training image' });
  }
});

// Get detected people for a specific image
router.get('/images/:imageId/people', (req, res) => {
  try {
    const people = imagePeopleDb.getByImageId(req.params.imageId);

    // Enrich with member data
    const enriched = people.map(p => {
      const member = p.family_member_id ? familyMemberDb.getById(p.family_member_id) : null;
      return {
        ...p,
        member
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching detected people:', error);
    res.status(500).json({ error: 'Failed to fetch detected people' });
  }
});

// Manually add a person to an image
router.post('/images/:imageId/people', (req, res) => {
  try {
    const { family_member_id } = req.body;
    const { imageId } = req.params;

    if (!family_member_id) {
      return res.status(400).json({ error: 'family_member_id is required' });
    }

    // Verify image exists
    const image = imageDb.getById(imageId);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Verify family member exists
    const member = familyMemberDb.getById(family_member_id);
    if (!member) {
      return res.status(404).json({ error: 'Family member not found' });
    }

    // Check if this person is already tagged in this image
    const existing = imagePeopleDb.getByImageId(imageId);
    if (existing.some(p => p.family_member_id === family_member_id)) {
      return res.status(409).json({ error: 'This person is already tagged in this image' });
    }

    const person: Omit<ImagePerson, 'created_at' | 'updated_at'> = {
      id: uuidv4(),
      image_id: imageId,
      family_member_id,
      confidence: 1.0, // Manual tag = 100% confidence
      bounding_box: null,
      verified: true
    };

    const created = imagePeopleDb.create(person);

    // Enrich with member data
    const enriched = {
      ...created,
      member
    };

    res.status(201).json(enriched);
  } catch (error) {
    console.error('Error adding person to image:', error);
    res.status(500).json({ error: 'Failed to add person to image' });
  }
});

// Update detected person (e.g., verify or correct identification)
router.put('/people/:id', (req, res) => {
  try {
    const { family_member_id, confidence, bounding_box, verified } = req.body;

    const existing = imagePeopleDb.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Detected person not found' });
    }

    const updates: Partial<Omit<ImagePerson, 'id' | 'created_at' | 'updated_at'>> = {};
    if (family_member_id !== undefined) updates.family_member_id = family_member_id;
    if (confidence !== undefined) updates.confidence = confidence;
    if (bounding_box !== undefined) updates.bounding_box = JSON.stringify(bounding_box);
    if (verified !== undefined) updates.verified = verified;

    const updated = imagePeopleDb.update(req.params.id, updates);
    res.json(updated);
  } catch (error) {
    console.error('Error updating detected person:', error);
    res.status(500).json({ error: 'Failed to update detected person' });
  }
});

// Delete a detected person
router.delete('/people/:id', (req, res) => {
  try {
    const deleted = imagePeopleDb.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Detected person not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting detected person:', error);
    res.status(500).json({ error: 'Failed to delete detected person' });
  }
});

// Get all images with detected people
router.get('/images-with-people', (req, res) => {
  try {
    const imageIds = imagePeopleDb.getImagesWithPeople();
    const images = imageIds.map(id => imageDb.getById(id)).filter(img => img !== undefined);
    res.json(images);
  } catch (error) {
    console.error('Error fetching images with people:', error);
    res.status(500).json({ error: 'Failed to fetch images with people' });
  }
});

// Recognize people in an image using AI
router.post('/images/:imageId/recognize', async (req, res) => {
  try {
    const { imageId } = req.params;
    const { save = true } = req.body; // Whether to save detected people to database

    // Check if image exists
    const image = imageDb.getById(imageId);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Get base directory
    const BASE_DIR = process.env.BASE_DIR || process.cwd();
    const uploadsDir = path.join(BASE_DIR, 'uploads');
    const imagePath = path.join(uploadsDir, 'optimized', `${path.parse(image.filename).name}.webp`);

    // Recognize people
    const result = await recognizePeople(imagePath, uploadsDir);

    // Save detected people to database if requested
    if (save) {
      // Delete existing detections for this image
      imagePeopleDb.deleteByImageId(imageId);

      // Save new detections
      for (const person of result.people) {
        imagePeopleDb.create({
          id: uuidv4(),
          image_id: imageId,
          family_member_id: person.family_member_id,
          confidence: person.confidence,
          bounding_box: person.bounding_box ? JSON.stringify(person.bounding_box) : null,
          verified: false
        });
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error recognizing people:', error);
    res.status(500).json({ error: 'Failed to recognize people' });
  }
});

// Batch recognize people in multiple images (OPTIMIZED: 1 API call for all images)
router.post('/batch-recognize', async (req, res) => {
  try {
    const { image_ids, save = true, batch_size = 10 } = req.body;

    if (!Array.isArray(image_ids) || image_ids.length === 0) {
      return res.status(400).json({ error: 'image_ids array is required' });
    }

    const BASE_DIR = process.env.BASE_DIR || process.cwd();
    const uploadsDir = path.join(BASE_DIR, 'uploads');

    // Prepare image paths
    const imagePaths: Array<{ id: string; path: string }> = [];
    const notFound: string[] = [];

    for (const imageId of image_ids) {
      const image = imageDb.getById(imageId);
      if (!image) {
        notFound.push(imageId);
        continue;
      }
      const imagePath = path.join(uploadsDir, 'optimized', `${path.parse(image.filename).name}.webp`);
      imagePaths.push({ id: imageId, path: imagePath });
    }

    // Process in batches to avoid Gemini token limits
    const allResults: Array<{ image_id: string; people: any[] }> = [];

    for (let i = 0; i < imagePaths.length; i += batch_size) {
      const batch = imagePaths.slice(i, i + batch_size);
      console.log(`[Batch Recognition] Processing batch ${Math.floor(i / batch_size) + 1}/${Math.ceil(imagePaths.length / batch_size)} (${batch.length} images)`);

      // SINGLE API CALL for this batch
      const batchResults = await recognizePeopleBatch(batch, uploadsDir);
      allResults.push(...batchResults);
    }

    // Save to database if requested
    if (save) {
      for (const result of allResults) {
        // Delete existing detections
        imagePeopleDb.deleteByImageId(result.image_id);

        // Save new detections
        for (const person of result.people) {
          imagePeopleDb.create({
            id: uuidv4(),
            image_id: result.image_id,
            family_member_id: person.family_member_id,
            confidence: person.confidence,
            bounding_box: person.bounding_box ? JSON.stringify(person.bounding_box) : null,
            verified: false
          });
        }
      }
    }

    const totalPeople = allResults.reduce((sum, r) => sum + r.people.length, 0);

    res.json({
      results: allResults,
      not_found: notFound,
      summary: {
        total_images: image_ids.length,
        successful: allResults.length,
        not_found: notFound.length,
        total_people_detected: totalPeople,
        api_calls_made: Math.ceil(imagePaths.length / batch_size) // Number of Gemini API calls
      }
    });
  } catch (error) {
    console.error('Error in batch recognition:', error);
    res.status(500).json({ error: 'Failed to batch recognize people' });
  }
});

export default router;
