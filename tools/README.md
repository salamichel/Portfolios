# Theme Uploader Tool

Outil Python pour uploader des thèmes (dossiers d'images) vers l'application Portfolio.

## Installation

```bash
cd tools
pip install -r requirements.txt
```

## Structure des dossiers

Organisez vos thèmes comme suit :

```
mes_themes/
├── Paysages/
│   ├── montagne.jpg
│   ├── mer.png
│   └── theme.json          # Optionnel
├── Portraits/
│   ├── portrait1.jpg
│   ├── portrait2.jpg
│   └── description.txt     # Optionnel
└── Street Photography/
    ├── rue1.jpg
    └── rue2.webp
```

### Fichiers de métadonnées (optionnels)

**theme.json** - Configuration complète du thème :
```json
{
  "name": "Nom personnalisé du thème",
  "description": "Description détaillée du thème"
}
```

**description.txt** - Fichier texte simple contenant la description :
```
Ma description du thème
sur plusieurs lignes si besoin.
```

Si aucun fichier de métadonnées n'est présent, le nom du dossier est utilisé comme nom du thème.

## Utilisation

### Usage de base

```bash
# Uploader tous les thèmes d'un dossier
python theme_uploader.py /chemin/vers/mes_themes

# Avec affichage détaillé
python theme_uploader.py /chemin/vers/mes_themes -v
```

### Options avancées

```bash
# Spécifier une URL d'API différente
python theme_uploader.py ./themes --api-url http://mon-serveur:3001/api

# Activer l'enrichissement AI (Gemini)
python theme_uploader.py ./themes --auto-enrich

# Simulation (voir ce qui serait fait sans rien créer)
python theme_uploader.py ./themes --dry-run

# Uploader un seul thème
python theme_uploader.py ./themes --single "Paysages"

# Ignorer les thèmes qui existent déjà
python theme_uploader.py ./themes --skip-existing
```

### Toutes les options

| Option | Description |
|--------|-------------|
| `themes_folder` | Dossier contenant les sous-dossiers de thèmes (obligatoire) |
| `--api-url` | URL de l'API (défaut: `http://localhost:3001/api`) |
| `--auto-enrich` | Activer l'enrichissement Gemini AI pour les images |
| `--dry-run` | Simuler sans créer/uploader |
| `--single THEME` | Uploader uniquement le thème spécifié |
| `--skip-existing` | Ignorer les thèmes déjà existants |
| `-v, --verbose` | Affichage détaillé |

## Formats d'images supportés

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

## Exemples

### Uploader avec enrichissement AI

```bash
python theme_uploader.py ~/Photos/themes --auto-enrich -v
```

### Tester avant d'exécuter

```bash
python theme_uploader.py ~/Photos/themes --dry-run -v
```

### Ajouter de nouveaux thèmes sans doublons

```bash
python theme_uploader.py ~/Photos/themes --skip-existing -v
```

## Prérequis

- Python 3.10+
- Le serveur Portfolio doit être démarré (`npm run dev` ou Docker)
- Connexion réseau vers l'API
