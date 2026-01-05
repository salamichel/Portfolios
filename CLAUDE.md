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
│   │   ├── database.ts        # Schéma SQLite et fonctions ORM
│   │   ├── routes/            # Endpoints REST API
│   │   │   ├── images.ts      # Upload, métadonnées, enrichissement
│   │   │   ├── themes.ts      # CRUD thèmes
│   │   │   ├── books.ts       # CRUD livres et pages
│   │   │   ├── templates.ts   # Templates de mise en page
│   │   │   ├── cleanup.ts     # Nettoyage tags/moods
│   │   │   └── enrichment-configs.ts  # Configuration IA enrichissement
│   │   └── services/          # Logique métier
│   │       ├── gemini.ts      # Intégration Gemini AI
│   │       └── bookLayoutAI.ts # Suggestions mise en page IA
│   └── scripts/               # Scripts utilitaires
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
4. `client/src/pages/FamilyAdmin.tsx` - UI gestion famille et entraînement
5. `client/src/components/ImageGallery.tsx` - Affichage personnes détectées
6. Accès via `/admin/family` ou icône 👥 dans le header
7. Documentation complète dans `FAMILLE_RECONNAISSANCE.md`

## Base de données - Tables principales

| Table | Description |
|-------|-------------|
| `themes` | Collections/catégories de portfolio |
| `images` | Métadonnées images + flags enrichissement IA + enrichment_config_id |
| `books` | Projets de livres (draft → published) |
| `book_pages` | Pages double avec layout slots |
| `page_templates` | Templates prédéfinis et personnalisés |
| `enrichment_configs` | Configurations IA (prompts, modèles Gemini) |
| `family_members` | **NOUVEAU** - Membres de famille pour reconnaissance faciale |
| `training_images` | **NOUVEAU** - Photos d'entraînement associées à chaque membre |
| `image_people` | **NOUVEAU** - Personnes détectées par IA dans les images |

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
import { imageDb, themeDb, bookDb, templateDb, enrichmentConfigDb } from './database';
const image = imageDb.getById(id);
const defaultConfig = enrichmentConfigDb.getDefault();
```

### Services (logique métier)
```typescript
// server/src/services/gemini.ts
import { analyzeImage, generateBookLayout } from './services/gemini';
```

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `GEMINI_API_KEY` | Clé API Google Gemini | Requis |
| `GEMINI_BOOK_API_KEY` | Clé API pour livres | Fallback sur GEMINI_API_KEY |
| `PORT` | Port serveur | 3001 |
| `NODE_ENV` | Environnement | development |
| `AI_REQUEST_TIMEOUT_MS` | Timeout IA | 45000 |
| `AI_MAX_RETRIES` | Tentatives max IA | 3 |

## Commandes utiles

```bash
# Développement
npm run dev              # Lance client + server avec hot-reload

# Production
docker-compose up -d     # Déploie avec Docker

# Build
npm run build            # Build client + server
```

## Fichiers volumineux à connaître

| Fichier | Taille | Responsabilité |
|---------|--------|----------------|
| `ImageGallery.tsx` | 40KB | Galerie avec pagination, filtres, édition inline |
| `BookEditor.tsx` | 31KB | Création/édition de livres complets |
| `bookLayoutAI.ts` | 44KB | Moteur de suggestions IA pour layouts |
| `database.ts` | ~20KB | Schéma complet + toutes les fonctions CRUD |
| `EnrichmentConfigAdmin.tsx` | ~10KB | Page admin configuration IA |

## Notes de développement

- **State management**: React Query pour état serveur, useState pour UI
- **Styling**: Tailwind CSS avec thème sombre global
- **Images**: Sharp pour conversion WebP et thumbnails
- **IDs**: UUIDs générés côté serveur

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
