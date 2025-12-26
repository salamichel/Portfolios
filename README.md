# Portfolios

Portfolio artistique moderne avec gestion d'images intelligente et enrichissement par IA Gemini.

## 📋 Description

Application web full-stack permettant de créer et gérer des portfolios artistiques avec :
- 🎨 Interface drag & drop intuitive pour organiser vos images
- 🤖 Enrichissement automatique des métadonnées par Gemini AI
- 📚 Assistant IA pour la mise en page de livres
- 🔍 Recherche avancée par nom de fichier
- 🎭 Gestion de thèmes et collections
- 📱 Interface responsive avec Tailwind CSS

## 🛠️ Stack Technique

### Client
- **React 19** avec TypeScript
- **Vite** pour le build et le dev server
- **Tailwind CSS 4** pour le styling
- **React Query** pour la gestion du state server
- **React Dropzone** pour l'upload drag & drop
- **Lucide React** pour les icônes

### Server
- **Node.js** avec Express et TypeScript
- **SQLite** (better-sqlite3) comme base de données
- **Google Generative AI (Gemini)** pour l'enrichissement des images
- **Multer** pour l'upload de fichiers
- **Sharp** pour le traitement d'images (conversion WebP, redimensionnement)
- **UUID** pour la génération d'identifiants uniques

## 🚀 Installation

### Prérequis
- Node.js 18+
- npm ou yarn

### Installation locale

1. Cloner le repository :
```bash
git clone <repository-url>
cd Portfolios
```

2. Installer les dépendances :
```bash
npm install
```

3. Configurer les variables d'environnement :
```bash
cp .env.example .env
```

Éditer `.env` et ajouter votre clé API Gemini :
```
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
```

4. Lancer l'application en mode développement :
```bash
npm run dev
```

L'application sera accessible sur :
- Client : http://localhost:5173
- Server API : http://localhost:3001

### Installation avec Docker

1. Configurer les variables d'environnement dans `.env`

2. Lancer avec Docker Compose :
```bash
docker-compose up -d
```

L'application sera accessible sur http://localhost

Pour le développement avec hot-reload :
```bash
docker-compose -f docker-compose.dev.yml up
```

## 📦 Scripts disponibles

```bash
# Développement
npm run dev              # Lance client + server en mode dev
npm run dev:client       # Lance uniquement le client
npm run dev:server       # Lance uniquement le server

# Production
npm run build            # Build client + server
npm start                # Lance le server en production
```

## 🏗️ Structure du projet

```
Portfolios/
├── client/              # Application React
│   ├── src/
│   ├── public/
│   └── package.json
├── server/              # API Express
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── tools/               # Outils et scripts
├── uploads/             # Fichiers uploadés
├── data/                # Base de données SQLite
├── docker-compose.yml   # Configuration Docker production
├── docker-compose.dev.yml  # Configuration Docker développement
└── package.json         # Configuration monorepo
```

## 🔑 Fonctionnalités principales

### Upload et gestion d'images
- Drag & drop d'images
- Upload direct depuis la sidebar
- Conversion automatique en WebP pour optimisation
- Prévisualisation et métadonnées

### Enrichissement par IA
- Analyse automatique des images avec Gemini AI
- Génération de descriptions et tags
- Assistant de mise en page pour livres
- Suggestions de design

### Organisation
- Création de thèmes et collections
- Recherche par nom de fichier ou nom original
- Interface de galerie responsive
- Sidebar sticky avec scroll overflow

## 🔒 Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `GEMINI_API_KEY` | Clé API Google Gemini (requis) | - |
| `GEMINI_BOOK_API_KEY` | Clé API Gemini dédiée pour le book (optionnel, fallback sur GEMINI_API_KEY) | - |
| `PORT` | Port du serveur API | 3001 |
| `NODE_ENV` | Environnement (development/production) | development |
| `AI_REQUEST_TIMEOUT_MS` | Timeout pour les requêtes IA en millisecondes | 45000 |
| `AI_MAX_RETRIES` | Nombre maximum de tentatives en cas d'échec réseau | 3 |

## 📝 License

ISC

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.
