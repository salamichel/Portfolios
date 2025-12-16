#!/usr/bin/env python3
"""
Theme Uploader Tool

Parcourt un dossier contenant des thèmes (sous-dossiers) et les crée en ligne
via l'API Portfolio, avec toutes leurs images.

Structure attendue:
    themes_folder/
    ├── MonTheme1/
    │   ├── image1.jpg
    │   ├── image2.png
    │   └── theme.json (optionnel)
    ├── MonTheme2/
    │   ├── photo1.jpg
    │   └── description.txt (optionnel)
    └── ...

Fichiers de métadonnées optionnels:
- theme.json: {"name": "Nom personnalisé", "description": "Ma description"}
- description.txt: Contenu utilisé comme description du thème
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

import requests
from tqdm import tqdm

# Extensions d'images supportées
SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}


@dataclass
class ThemeConfig:
    """Configuration d'un thème extraite du dossier."""
    name: str
    description: Optional[str] = None
    folder_path: Path = None


def parse_args():
    """Parse les arguments de la ligne de commande."""
    parser = argparse.ArgumentParser(
        description="Upload de thèmes (dossiers d'images) vers l'API Portfolio",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples:
  %(prog)s /chemin/vers/mes/themes
  %(prog)s ./themes --api-url http://localhost:3001/api
  %(prog)s ./themes --auto-enrich --dry-run
  %(prog)s ./themes --single MonTheme
        """
    )

    parser.add_argument(
        'themes_folder',
        type=Path,
        help='Dossier contenant les sous-dossiers de thèmes'
    )

    parser.add_argument(
        '--api-url',
        type=str,
        default='http://localhost:3001/api',
        help='URL de base de l\'API (défaut: http://localhost:3001/api)'
    )

    parser.add_argument(
        '--auto-enrich',
        action='store_true',
        help='Activer l\'enrichissement automatique via Gemini AI'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Simuler les opérations sans rien créer'
    )

    parser.add_argument(
        '--single',
        type=str,
        metavar='THEME_NAME',
        help='Uploader uniquement le thème spécifié'
    )

    parser.add_argument(
        '--skip-existing',
        action='store_true',
        help='Ignorer les thèmes qui existent déjà'
    )

    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Afficher les détails des opérations'
    )

    return parser.parse_args()


def log(message: str, verbose: bool = True):
    """Affiche un message si verbose est activé."""
    if verbose:
        print(message)


def get_theme_config(folder_path: Path) -> ThemeConfig:
    """
    Extrait la configuration du thème depuis le dossier.

    Priorité:
    1. theme.json avec name et/ou description
    2. description.txt pour la description
    3. Nom du dossier comme nom du thème
    """
    config = ThemeConfig(
        name=folder_path.name,
        folder_path=folder_path
    )

    # Chercher theme.json
    theme_json_path = folder_path / 'theme.json'
    if theme_json_path.exists():
        try:
            with open(theme_json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                config.name = data.get('name', config.name)
                config.description = data.get('description')
        except (json.JSONDecodeError, IOError) as e:
            print(f"  Avertissement: Impossible de lire {theme_json_path}: {e}")

    # Chercher description.txt si pas de description
    if not config.description:
        desc_txt_path = folder_path / 'description.txt'
        if desc_txt_path.exists():
            try:
                with open(desc_txt_path, 'r', encoding='utf-8') as f:
                    config.description = f.read().strip()
            except IOError as e:
                print(f"  Avertissement: Impossible de lire {desc_txt_path}: {e}")

    return config


def get_image_files(folder_path: Path) -> list[Path]:
    """Retourne la liste des fichiers images dans le dossier."""
    images = []
    for file_path in folder_path.iterdir():
        if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
            images.append(file_path)
    return sorted(images)


def check_theme_exists(api_url: str, theme_name: str) -> Optional[str]:
    """
    Vérifie si un thème existe déjà par son nom.
    Retourne l'ID du thème s'il existe, None sinon.
    """
    try:
        response = requests.get(f"{api_url}/themes", timeout=10)
        response.raise_for_status()
        themes = response.json()

        for theme in themes:
            if theme.get('name', '').lower() == theme_name.lower():
                return theme.get('id')
        return None
    except requests.RequestException:
        return None


def create_theme(api_url: str, config: ThemeConfig, dry_run: bool = False) -> Optional[str]:
    """
    Crée un thème via l'API.
    Retourne l'ID du thème créé ou None en cas d'erreur.
    """
    if dry_run:
        print(f"  [DRY-RUN] Créerait le thème: {config.name}")
        return "dry-run-id"

    payload = {
        'name': config.name
    }
    if config.description:
        payload['description'] = config.description

    try:
        response = requests.post(
            f"{api_url}/themes",
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        theme_data = response.json()
        return theme_data.get('id')
    except requests.RequestException as e:
        print(f"  Erreur lors de la création du thème: {e}")
        return None


def upload_image(
    api_url: str,
    image_path: Path,
    theme_id: str,
    auto_enrich: bool = False,
    dry_run: bool = False
) -> bool:
    """
    Upload une image vers l'API.
    Retourne True si succès, False sinon.
    """
    if dry_run:
        return True

    try:
        with open(image_path, 'rb') as f:
            files = {
                'images': (image_path.name, f, f'image/{image_path.suffix[1:].lower()}')
            }
            data = {
                'theme_id': theme_id,
                'auto_enrich': 'true' if auto_enrich else 'false'
            }

            response = requests.post(
                f"{api_url}/images/upload",
                files=files,
                data=data,
                timeout=60  # Timeout plus long pour les gros fichiers
            )
            response.raise_for_status()
            return True
    except requests.RequestException as e:
        print(f"    Erreur upload {image_path.name}: {e}")
        return False


def upload_images_batch(
    api_url: str,
    images: list[Path],
    theme_id: str,
    auto_enrich: bool = False,
    dry_run: bool = False,
    verbose: bool = False
) -> tuple[int, int]:
    """
    Upload plusieurs images vers un thème.
    Retourne (nombre de succès, nombre d'échecs).
    """
    success_count = 0
    fail_count = 0

    progress_bar = tqdm(images, desc="    Images", unit="img", disable=not verbose)

    for image_path in progress_bar:
        if dry_run:
            progress_bar.set_postfix_str(f"[DRY-RUN] {image_path.name}")
            success_count += 1
        else:
            if upload_image(api_url, image_path, theme_id, auto_enrich, dry_run):
                success_count += 1
            else:
                fail_count += 1

    return success_count, fail_count


def discover_themes(themes_folder: Path, single: Optional[str] = None) -> list[Path]:
    """
    Découvre les dossiers de thèmes.
    Si single est spécifié, ne retourne que ce thème.
    """
    if not themes_folder.is_dir():
        raise ValueError(f"Le dossier n'existe pas: {themes_folder}")

    theme_folders = []

    for item in sorted(themes_folder.iterdir()):
        if item.is_dir() and not item.name.startswith('.'):
            if single is None or item.name == single:
                theme_folders.append(item)

    if single and not theme_folders:
        raise ValueError(f"Thème non trouvé: {single}")

    return theme_folders


def process_theme(
    folder_path: Path,
    api_url: str,
    auto_enrich: bool = False,
    dry_run: bool = False,
    skip_existing: bool = False,
    verbose: bool = False
) -> dict:
    """
    Traite un dossier de thème complet.
    Retourne un dict avec les statistiques.
    """
    stats = {
        'name': folder_path.name,
        'created': False,
        'skipped': False,
        'images_uploaded': 0,
        'images_failed': 0,
        'error': None
    }

    # Extraire la configuration
    config = get_theme_config(folder_path)
    stats['name'] = config.name

    log(f"\nThème: {config.name}", verbose)
    if config.description:
        log(f"  Description: {config.description[:50]}...", verbose)

    # Lister les images
    images = get_image_files(folder_path)
    log(f"  Images trouvées: {len(images)}", verbose)

    if not images:
        log("  Aucune image, thème ignoré", verbose)
        stats['skipped'] = True
        return stats

    # Vérifier si le thème existe
    if skip_existing:
        existing_id = check_theme_exists(api_url, config.name)
        if existing_id:
            log(f"  Thème existant (ID: {existing_id}), ignoré", verbose)
            stats['skipped'] = True
            return stats

    # Créer le thème
    theme_id = create_theme(api_url, config, dry_run)
    if not theme_id:
        stats['error'] = "Impossible de créer le thème"
        return stats

    stats['created'] = True
    log(f"  Thème créé (ID: {theme_id})", verbose)

    # Uploader les images
    success, fail = upload_images_batch(
        api_url, images, theme_id, auto_enrich, dry_run, verbose
    )
    stats['images_uploaded'] = success
    stats['images_failed'] = fail

    return stats


def main():
    """Point d'entrée principal."""
    args = parse_args()

    print(f"=== Theme Uploader ===")
    print(f"Dossier source: {args.themes_folder}")
    print(f"API URL: {args.api_url}")

    if args.dry_run:
        print("Mode: DRY-RUN (simulation)")
    if args.auto_enrich:
        print("Enrichissement AI: Activé")
    if args.skip_existing:
        print("Skip existing: Activé")

    # Vérifier la connexion à l'API
    try:
        response = requests.get(f"{args.api_url}/themes", timeout=5)
        response.raise_for_status()
        print(f"Connexion API: OK")
    except requests.RequestException as e:
        print(f"Erreur: Impossible de se connecter à l'API: {e}")
        print("Assurez-vous que le serveur est démarré.")
        sys.exit(1)

    # Découvrir les thèmes
    try:
        theme_folders = discover_themes(args.themes_folder, args.single)
    except ValueError as e:
        print(f"Erreur: {e}")
        sys.exit(1)

    print(f"\nThèmes découverts: {len(theme_folders)}")

    # Traiter chaque thème
    all_stats = []

    for folder in theme_folders:
        stats = process_theme(
            folder,
            args.api_url,
            args.auto_enrich,
            args.dry_run,
            args.skip_existing,
            args.verbose
        )
        all_stats.append(stats)

    # Résumé final
    print("\n" + "=" * 40)
    print("RÉSUMÉ")
    print("=" * 40)

    total_created = sum(1 for s in all_stats if s['created'])
    total_skipped = sum(1 for s in all_stats if s['skipped'])
    total_errors = sum(1 for s in all_stats if s['error'])
    total_images = sum(s['images_uploaded'] for s in all_stats)
    total_failed = sum(s['images_failed'] for s in all_stats)

    print(f"Thèmes créés: {total_created}")
    print(f"Thèmes ignorés: {total_skipped}")
    print(f"Erreurs: {total_errors}")
    print(f"Images uploadées: {total_images}")
    print(f"Images échouées: {total_failed}")

    if total_errors > 0:
        print("\nDétails des erreurs:")
        for stats in all_stats:
            if stats['error']:
                print(f"  - {stats['name']}: {stats['error']}")

    # Code de sortie
    if total_errors > 0 or total_failed > 0:
        sys.exit(1)

    print("\nTerminé!")


if __name__ == '__main__':
    main()
