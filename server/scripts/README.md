# Server Scripts

This directory contains utility scripts for server maintenance.

## Regenerate Medium Thumbnails

Regenerates all medium-sized thumbnails (1600px) for existing images in the database.

### Usage

**Development mode (TypeScript):**
```bash
npm run regenerate-thumbnails
```

**Production mode (compiled JavaScript):**
```bash
npm run regenerate-thumbnails:prod
```

**Docker development:**
```bash
docker exec -it portfolio-server-dev npm run regenerate-thumbnails
```

**Docker production:**
```bash
docker exec -it portfolio-server npm run regenerate-thumbnails:prod
```

### What it does

- Fetches all images from the database
- For each image, regenerates the medium thumbnail at 1600x1600px (fit inside, no enlargement)
- Uses the optimized WebP version as source (or original if WebP not available)
- Maintains WebP quality at 85%
- Shows progress and statistics

### When to use

- After changing thumbnail size configuration
- To fix corrupted thumbnails
- After migrating/restoring images
