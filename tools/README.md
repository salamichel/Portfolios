# Theme Uploader Tool

Outil Python pour créer des thèmes sur l'application Portfolio à partir de dossiers locaux.

## Installation

```bash
pip install requests
```

Ou avec le fichier requirements.txt :
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
# Créer tous les thèmes (sans upload d'images)
python theme_uploader.py /chemin/vers/mes_themes

# Avec affichage détaillé
python theme_uploader.py /chemin/vers/mes_themes -v

# Ignorer les thèmes qui existent déjà
python theme_uploader.py /chemin/vers/mes_themes --skip-existing
```

### Upload d'images (optionnel)

```bash
# Créer les thèmes ET uploader les images
python theme_uploader.py ./themes --upload-images

# Avec enrichissement AI (Gemini)
python theme_uploader.py ./themes --upload-images --auto-enrich -v
```

### Autres options

```bash
# Spécifier une URL d'API différente (ex: serveur local)
python theme_uploader.py ./themes --api-url http://localhost:3001/api

# Simulation (voir ce qui serait fait sans rien créer)
python theme_uploader.py ./themes --dry-run

# Traiter un seul thème
python theme_uploader.py ./themes --single "Paysages"
```

### Toutes les options

| Option | Description |
|--------|-------------|
| `themes_folder` | Dossier contenant les sous-dossiers de thèmes (obligatoire) |
| `--api-url` | URL de l'API (défaut: `https://portfolio.moka-web.net/api`) |
| `--upload-images` | Uploader également les images (désactivé par défaut) |
| `--auto-enrich` | Activer l'enrichissement Gemini AI (nécessite --upload-images) |
| `--dry-run` | Simuler sans créer/uploader |
| `--single THEME` | Traiter uniquement le thème spécifié |
| `--skip-existing` | Ignorer les thèmes déjà existants |
| `-v, --verbose` | Affichage détaillé |

## Formats d'images supportés

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

## Exemples

### Créer des thèmes sur le serveur distant

```bash
python theme_uploader.py ~/Photos/themes
```

### Créer des thèmes sur un serveur local

```bash
python theme_uploader.py ~/Photos/themes --api-url http://localhost:3001/api
```

### Tester avant d'exécuter

```bash
python theme_uploader.py ~/Photos/themes --dry-run -v
```

### Ajouter de nouveaux thèmes sans doublons

```bash
python theme_uploader.py ~/Photos/themes --skip-existing
```

## Prérequis

- Python 3.10+
- Module `requests` installé
- Connexion réseau vers l'API Portfolio
