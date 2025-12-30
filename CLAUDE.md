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
│   │   │   └── cleanup.ts     # Nettoyage tags/moods
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

### Modifier la galerie d'images
1. `client/src/components/ImageGallery.tsx` - Composant principal (40KB)
2. `client/src/components/Header.tsx` - Contrôles recherche/filtres
3. `server/src/routes/images.ts` - API backend

### Gérer les templates de pages
1. `server/src/routes/templates.ts` - CRUD templates
2. `server/src/database.ts` - `templateDb` fonctions
3. `client/src/components/template/` - UI éditeur

## Base de données - Tables principales

| Table | Description |
|-------|-------------|
| `themes` | Collections/catégories de portfolio |
| `images` | Métadonnées images + flags enrichissement IA |
| `books` | Projets de livres (draft → published) |
| `book_pages` | Pages double avec layout slots |
| `page_templates` | Templates prédéfinis et personnalisés |

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
import { imageDb, themeDb, bookDb, templateDb } from './database';
const image = imageDb.getById(id);
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
| `database.ts` | ~15KB | Schéma complet + toutes les fonctions CRUD |

## Notes de développement

- **State management**: React Query pour état serveur, useState pour UI
- **Styling**: Tailwind CSS avec thème sombre global
- **Images**: Sharp pour conversion WebP et thumbnails
- **IDs**: UUIDs générés côté serveur
