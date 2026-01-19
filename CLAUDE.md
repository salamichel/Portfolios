# Portfolios - Guide de Navigation Claude Code

## Vue d'ensemble

Application portfolio artistique full-stack avec:
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express 5 + TypeScript + SQLite
- **IA**: Google Gemini pour enrichissement d'images et suggestions de mise en page

## Points d'entrée clés

| Composant | Fichier |
|-----------|---------|
| Frontend entry | `/client/src/main.tsx` → `/client/src/App.tsx` |
| Backend entry | `/server/src/index.ts` |
| Database/ORM | `/server/src/database.ts` |
| API client | `/client/src/api/client.ts` |

## Structure du projet

```
Portfolios/
├── client/                    # React 19 frontend
│   ├── src/
│   │   ├── components/        # Composants React réutilisables
│   │   │   ├── book/          # Éditeur de livre (slideshow, layout)
│   │   │   └── template/      # Éditeur de templates
│   │   ├── pages/             # Pages admin/éditeur
│   │   ├── api/               # Client API (axios wrapper)
│   │   ├── types/             # Interfaces TypeScript
│   │   └── utils/             # Utilitaires (richTextParser)
│   └── vite.config.ts
│
├── server/                    # Express API backend
│   ├── src/
│   │   ├── index.ts           # Configuration Express
│   │   ├── database.ts        # Schéma SQLite et fonctions ORM (1997 lignes)
│   │   ├── routes/            # Endpoints REST API
│   │   │   ├── images.ts      # Upload, métadonnées, enrichissement (630 lignes)
│   │   │   ├── themes.ts      # CRUD thèmes (121 lignes)
│   │   │   ├── books.ts       # CRUD livres et pages (314 lignes)
│   │   │   ├── templates.ts   # Templates de mise en page (138 lignes)
│   │   │   ├── cleanup.ts     # Analyse images similaires, merge tags/moods (220 lignes)
│   │   │   ├── enrichment-configs.ts  # Configuration IA enrichissement (138 lignes)
│   │   │   └── family.ts      # Reconnaissance familiale (611 lignes)
│   │   └── services/          # Logique métier
│   │       ├── gemini.ts      # Intégration Gemini AI (928 lignes)
│   │       ├── bookLayoutAI.ts # Suggestions mise en page IA (1297 lignes)
│   │       ├── processingReportService.ts # Tracking rapports livres (169 lignes)
│   │       └── imageEnrichmentReportService.ts # Tracking rapports enrichissement (159 lignes)
│   └── scripts/               # Scripts utilitaires
│       └── regenerate-medium-thumbnails.ts # Régénération thumbnails 1600px
│
├── tools/                     # Scripts Python (theme_uploader)
├── docker-compose.yml         # Production
└── docker-compose.dev.yml     # Développement
```

## Tâches courantes - Où chercher

### Ajouter un champ métadonnées image
1. `server/src/database.ts` - Interface `Image` + schéma SQL
2. `server/src/routes/images.ts` - Endpoint API
3. `client/src/types/` - Types frontend

### Modifier l'éditeur de livre
1. `client/src/pages/BookEditor.tsx` - Composant principal (31KB)
2. `client/src/components/book/` - Sous-composants
3. `server/src/services/bookLayoutAI.ts` - Logique IA suggestions

### Ajouter une fonctionnalité IA
1. `server/src/services/gemini.ts` - Appels API Gemini
2. `.env` - Variables `GEMINI_API_KEY`, `GEMINI_BOOK_API_KEY`

### Configurer l'enrichissement IA
1. `server/src/routes/enrichment-configs.ts` - CRUD configurations
2. `server/src/database.ts` - `enrichmentConfigDb` fonctions
3. `client/src/pages/EnrichmentConfigAdmin.tsx` - UI configuration
4. Accès via `/admin/enrichment` ou icône CPU dans le header

### Modifier la galerie d'images
1. `client/src/components/ImageGallery.tsx` - Composant principal (40KB)
2. `client/src/components/Header.tsx` - Contrôles recherche/filtres
3. `server/src/routes/images.ts` - API backend

### Gérer les templates de pages
1. `server/src/routes/templates.ts` - CRUD templates
2. `server/src/database.ts` - `templateDb` fonctions
3. `client/src/components/template/` - UI éditeur

### Reconnaissance familiale (nouvelle fonctionnalité)
1. `server/src/routes/family.ts` - CRUD membres famille, images d'entraînement, reconnaissance
2. `server/src/database.ts` - `familyMemberDb`, `trainingImageDb`, `imagePeopleDb` fonctions
3. `server/src/services/gemini.ts` - Fonction `recognizePeople()` utilisant Gemini AI
4. `client/src/pages/FamilyAdmin.tsx` - UI gestion famille et entraînement (911 lignes)
5. `client/src/components/ImageGallery.tsx` - Affichage personnes détectées
6. Accès via `/admin/family` ou icône 👥 dans le header
7. Documentation complète dans `FAMILLE_RECONNAISSANCE.md`

### Nettoyer et optimiser les métadonnées
1. `server/src/routes/cleanup.ts` - Analyse images similaires, suggestions merge tags/moods
2. `client/src/pages/CleanupAdmin.tsx` - UI cleanup avec analyse IA (363 lignes)
3. Accès via `/admin/cleanup`

### Gérer les rapports de traitement IA
1. `server/src/services/processingReportService.ts` - Tracking appels IA pour livres
2. `server/src/services/imageEnrichmentReportService.ts` - Tracking batch enrichissement
3. `server/src/database.ts` - `processingReportDb`, `enrichmentReportDb` fonctions
4. `client/src/components/book/ProcessingReportModal.tsx` - Affichage détails rapports (410 lignes)

## Base de données - Tables principales

| Table | Description |
|-------|-------------|
| `themes` | Collections/catégories de portfolio (reorderable, image counts) |
| `images` | Métadonnées images + flags enrichissement IA + enrichment_config_id + family_analyzed + no_people_marked |
| `books` | Projets de livres (status: draft/in_progress/pending_review/published) + tags + mood |
| `book_pages` | Pages double avec layout slots (template_id, page_data JSON, position) |
| `page_templates` | Templates prédéfinis (20) et personnalisés (layout JSON, category) |
| `enrichment_configs` | Configurations IA (prompts, modèles Gemini: flash/pro/flash-preview/pro-preview) |
| `family_members` | Membres de famille pour reconnaissance faciale (name, relationship, notes) |
| `training_images` | Photos d'entraînement associées à chaque membre (stockage séparé de la galerie) |
| `image_people` | Personnes détectées par IA dans les images (confidence, bounding_box JSON, verified) |
| `book_processing_reports` | Rapports traitement livres (status, api_calls_detail JSON, tokens, cache_hit) |
| `image_enrichment_reports` | Rapports batch enrichissement (status, images_enriched, images_failed, api_calls_detail JSON) |

## Patterns architecturaux

### API Client (frontend)
```typescript
// client/src/api/client.ts
import { api } from './client';
const images = await api.get('/api/images');
```

### Database ORM (backend)
```typescript
// server/src/database.ts
import {
  imageDb, themeDb, bookDb, templateDb, enrichmentConfigDb,
  familyMemberDb, trainingImageDb, imagePeopleDb,
  processingReportDb, enrichmentReportDb
} from './database';

const image = imageDb.getById(id);
const defaultConfig = enrichmentConfigDb.getDefault();
```

### Services (logique métier)
```typescript
// server/src/services/gemini.ts
import { analyzeImage, generateBookLayout, recognizePeople } from './services/gemini';

// server/src/services/bookLayoutAI.ts
import { generateAILayout } from './services/bookLayoutAI';
// Cache 15 min en mémoire, retry automatique, tracking tokens

// server/src/services/processingReportService.ts
import { createReport, getReportsByBookId } from './services/processingReportService';
```

## Architecture avancée

### Système de cache IA
- **Layout suggestions**: Cache en mémoire avec TTL 15 min (`AI_CACHE_TTL_MS`)
- **Clé**: Hash du contenu (images + configuration)
- **Gestion**: Nettoyage automatique des entrées expirées

### Rapports de traitement
- **Livres**: Tracking complet des appels API Gemini (prompts, réponses, tokens, cache hits)
- **Images**: Stats batch enrichissement (succès/échecs, détails API)
- **Affichage**: Modal détaillé dans BookEditor avec vue JSON complète

### Catégories de templates
6 catégories prédéfinies:
- `cover` - Pages de couverture
- `chapter` - Débuts de chapitres
- `standard` - Pages standard
- `gallery` - Grilles d'images
- `highlight` - Mise en valeur d'images
- `narrative` - Narration avec texte

### Multi-clé Gemini API
- `GEMINI_API_KEY`: Enrichissement images et reconnaissance familiale
- `GEMINI_BOOK_API_KEY`: Suggestions layouts livres (fallback sur GEMINI_API_KEY si absent)
- **Avantage**: Séparation des quotas et billing

### Training images (reconnaissance familiale)
- **Stockage séparé**: Dossier `/training_images/` distinct de `/uploads/`
- **Non visibles**: Pas affichées dans la galerie principale
- **Bounding boxes**: Coordonnées JSON pour crop facial précis
- **Verification**: Flag `verified` pour validation manuelle

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `GEMINI_API_KEY` | Clé API Google Gemini (enrichissement images) | Requis |
| `GEMINI_BOOK_API_KEY` | Clé API pour livres (fallback sur GEMINI_API_KEY) | GEMINI_API_KEY |
| `PORT` | Port serveur Express | 3001 |
| `BASE_DIR` | Répertoire base pour stockage (dev/Docker) | process.cwd() |
| `AI_REQUEST_TIMEOUT_MS` | Timeout requêtes IA (ms) | 45000 |
| `AI_MAX_RETRIES` | Tentatives max IA avec retry | 3 |
| `AI_CACHE_TTL_MS` | TTL cache suggestions layouts IA (ms) | 900000 (15 min) |
| `NODE_ENV` | Environnement (development/production) | development |

## Commandes utiles

```bash
# Développement
npm run dev              # Lance client + server avec hot-reload
npm run dev:client       # Lance seulement le client (Vite)
npm run dev:server       # Lance seulement le server (tsx watch)

# Production
docker-compose up -d     # Déploie avec Docker
npm start                # Lance serveur en production (après build)

# Build
npm run build            # Build client + server

# Scripts utilitaires (depuis /server)
npm run regenerate-thumbnails       # Régénère thumbnails 1600px (dev)
npm run regenerate-thumbnails:prod  # Régénère thumbnails 1600px (prod)
```

## Fichiers volumineux à connaître

| Fichier | Lignes | Responsabilité |
|---------|--------|----------------|
| `ImageGallery.tsx` | 1440 | Galerie avec pagination, filtres multi (theme/tag/mood/person), édition inline |
| `FamilyAdmin.tsx` | 911 | Gestion famille complète: members, training images, reconnaissance IA |
| `BookEditor.tsx` | 871 | Création/édition de livres complets avec templates et layouts |
| `bookLayoutAI.ts` | 1297 | Moteur de suggestions IA pour layouts (cache 15min, retry, tokens) |
| `database.ts` | 1997 | Schéma complet SQLite + toutes les fonctions CRUD (11 objets Db) |
| `gemini.ts` | 928 | Client Gemini AI (analyze, batch, similarity, recognition) |
| `images.ts` (routes) | 630 | Upload, métadonnées, enrichissement, filtres avancés |
| `family.ts` (routes) | 611 | CRUD famille + reconnaissance + training images |
| `ProcessingReportModal.tsx` | 410 | Affichage détails rapports traitement IA |
| `EnrichmentConfigAdmin.tsx` | 362 | Page admin configuration IA (prompts, modèles) |
| `CleanupAdmin.tsx` | 363 | Interface cleanup tags/moods avec analyse IA |

## Pages d'administration

Toutes accessibles depuis le header avec icônes:

| Page | Route | Icône | Responsabilité |
|------|-------|-------|----------------|
| AdminThemes | `/admin/themes` | 🎨 | Gestion thèmes, reorder, cover images (618 lignes) |
| BookList | `/admin/books` | 📚 | Liste livres, filtres status, page counts (293 lignes) |
| BookEditor | `/admin/books/:id` | ✏️ | Éditeur complet de livres (871 lignes) |
| EnrichmentConfigAdmin | `/admin/enrichment` | 🖥️ CPU | Configuration IA enrichissement (362 lignes) |
| FamilyAdmin | `/admin/family` | 👥 | Reconnaissance familiale (911 lignes) |
| CleanupAdmin | `/admin/cleanup` | 🧹 | Nettoyage tags/moods, analyse similarité (363 lignes) |
| TemplateEditor | `/admin/templates` | 📄 | Création templates personnalisés (445 lignes) |

## Notes de développement

- **State management**: React Query (@tanstack/react-query) pour état serveur, useState pour UI
- **Styling**: Tailwind CSS avec thème sombre global
- **Images**: Sharp pour conversion WebP et thumbnails (small 400px, medium 1600px)
- **IDs**: UUIDs générés côté serveur
- **Routing**: React Router v7
- **HTTP Client**: Axios avec wrapper dans `client/src/api/client.ts`
- **Icons**: Lucide React
- **Database**: Better-sqlite3 (synchrone)
- **Upload**: Multer + react-dropzone
- **IA**: @google/generative-ai (Gemini flash/pro, preview models)

---

## Hooks Claude Code

Le projet utilise un hook automatique pour maintenir CLAUDE.md à jour:

**Hook PostToolUse** (`.claude/settings.json:6-13`)
- **Trigger**: Après chaque Write/Edit/MultiEdit
- **Action**: Détecte les modifications de fichiers structurels
- **Patterns surveillés**: `database.ts`, `/routes/`, `/services/`, `/components/`, `/pages/`, `types/`, `package.json`
- **Output**: Rappel visuel à l'écran si mise à jour CLAUDE.md nécessaire

Exemple de rappel affiché:
```
📝 RAPPEL: Fichier structurel modifié (server/src/routes/example.ts)
   → Vérifier si CLAUDE.md doit être mis à jour
```

**Configuration du hook:**
```json
{
  "matcher": "Write|Edit|MultiEdit",
  "type": "command",
  "timeout_ms": 3000,
  "command": "bash -c 'file_path=$(cat | jq -r \".tool_input.file_path // empty\"); if echo \"$file_path\" | grep -qE \"(database\\.ts|/routes/|/services/|/components/|/pages/|types/|package\\.json)\" && ! echo \"$file_path\" | grep -q \"CLAUDE.md\"; then echo \"📝 RAPPEL: Fichier structurel modifié ($file_path)\" >&2; echo \"   → Vérifier si CLAUDE.md doit être mis à jour\" >&2; fi; exit 0'"
}
```

---

## Maintenance de ce fichier (Instructions pour Claude)

> **IMPORTANT**: Ce fichier doit rester à jour avec l'évolution du codebase.

### Quand mettre à jour CLAUDE.md

Claude doit mettre à jour ce fichier automatiquement lors de :

1. **Ajout de nouveaux fichiers/dossiers importants**
   - Nouveaux composants React significatifs
   - Nouvelles routes API
   - Nouveaux services

2. **Modifications structurelles**
   - Renommage de fichiers clés
   - Changement d'architecture
   - Nouvelles tables en base de données

3. **Nouvelles fonctionnalités majeures**
   - Ajouter une entrée dans "Tâches courantes"
   - Documenter les nouveaux patterns

4. **Changements de dépendances majeures**
   - Mise à jour de version importante (React, Express, etc.)
   - Ajout de nouvelles bibliothèques clés

### Comment maintenir ce fichier

```markdown
Après chaque modification significative du codebase :
1. Vérifier si CLAUDE.md reflète encore la réalité
2. Mettre à jour les sections concernées
3. Inclure la mise à jour dans le même commit ou un commit séparé
```

### Sections à surveiller

| Section | Mettre à jour quand... |
|---------|------------------------|
| Structure du projet | Nouveaux dossiers/fichiers importants |
| Tâches courantes | Nouveau workflow ou fonctionnalité |
| Base de données | Nouvelle table ou modification schéma |
| Variables d'environnement | Nouvelle config requise |
| Fichiers volumineux | Fichier devient >20KB ou est critique |

### Rappel automatique

Si Claude effectue une modification qui devrait mettre à jour ce fichier mais ne le fait pas, l'utilisateur peut rappeler :
> "N'oublie pas de mettre à jour CLAUDE.md avec ces changements"
