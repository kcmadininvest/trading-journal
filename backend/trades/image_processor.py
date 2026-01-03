"""
Service de traitement d'images pour les screenshots.
Compression, redimensionnement et génération de miniatures.
"""

import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Tuple
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from PIL import Image
from io import BytesIO
import logging

logger = logging.getLogger(__name__)


class ImageProcessor:
    """
    Service de traitement d'images.
    Gère la compression, le redimensionnement et la génération de miniatures.
    """
    
    # Qualité de compression (0-100)
    COMPRESSION_QUALITY = 85
    
    # Dimensions des miniatures (largeur x hauteur max)
    THUMBNAIL_SIZE = (300, 300)
    
    # Format de sortie
    OUTPUT_FORMAT = 'WEBP'
    
    def __init__(self):
        """Initialise le processeur d'images."""
        self.media_root = Path(settings.MEDIA_ROOT)
        self.media_url = settings.MEDIA_URL
    
    def _generate_filename(self, user_id: int, extension: str = 'webp') -> Tuple[str, str]:
        """
        Génère un nom de fichier sécurisé et unique.
        
        Args:
            user_id: ID de l'utilisateur
            extension: Extension du fichier
            
        Returns:
            Tuple (chemin relatif, chemin absolu)
        """
        now = datetime.now()
        year = now.strftime('%Y')
        month = now.strftime('%m')
        
        # Créer un nom unique avec UUID + timestamp
        unique_id = uuid.uuid4().hex
        timestamp = now.strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{unique_id}.{extension}"
        
        # Chemin relatif : screenshots/user_id/year/month/filename
        relative_path = os.path.join(
            'screenshots',
            str(user_id),
            year,
            month,
            filename
        )
        
        # Chemin absolu
        absolute_path = self.media_root / relative_path
        
        # Créer les répertoires si nécessaire
        absolute_path.parent.mkdir(parents=True, exist_ok=True)
        
        return relative_path, str(absolute_path)
    
    def _get_url(self, relative_path: str) -> str:
        """
        Convertit un chemin relatif en URL accessible.
        
        Args:
            relative_path: Chemin relatif du fichier
            
        Returns:
            URL complète du fichier
        """
        # Normaliser le chemin pour utiliser des slashes
        normalized_path = relative_path.replace('\\', '/')
        
        # Construire l'URL
        if self.media_url.endswith('/'):
            return f"{self.media_url}{normalized_path}"
        else:
            return f"{self.media_url}/{normalized_path}"
    
    def _compress_image(self, image: Image.Image) -> Image.Image:
        """
        Compresse une image en conservant la qualité.
        
        Args:
            image: Image PIL à compresser
            
        Returns:
            Image compressée
        """
        # Convertir en RGB si nécessaire (pour JPEG/WEBP)
        if image.mode in ('RGBA', 'LA', 'P'):
            # Créer un fond blanc pour les images avec transparence
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        
        return image
    
    def _create_thumbnail(self, image: Image.Image) -> Image.Image:
        """
        Crée une miniature en préservant le ratio d'aspect.
        
        Args:
            image: Image PIL source
            
        Returns:
            Miniature
        """
        # Copier l'image pour ne pas modifier l'originale
        thumbnail = image.copy()
        
        # Redimensionner en conservant le ratio
        thumbnail.thumbnail(self.THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
        
        return thumbnail
    
    def process_screenshot(
        self,
        file: UploadedFile,
        user_id: int
    ) -> Tuple[str, str]:
        """
        Traite un screenshot : compression et génération de miniature.
        
        Args:
            file: Fichier uploadé
            user_id: ID de l'utilisateur
            
        Returns:
            Tuple (URL originale, URL miniature)
        """
        try:
            # Lire l'image
            file.seek(0)
            image = Image.open(file)
            
            # Appliquer la rotation EXIF si nécessaire
            try:
                from PIL import ImageOps
                image = ImageOps.exif_transpose(image)
            except Exception as e:
                logger.warning(f"Impossible d'appliquer la rotation EXIF : {e}")
            
            # Compresser l'image originale
            compressed_image = self._compress_image(image)
            
            # Générer les noms de fichiers
            original_rel_path, original_abs_path = self._generate_filename(
                user_id, 
                self.OUTPUT_FORMAT.lower()
            )
            
            # Sauvegarder l'image originale compressée
            compressed_image.save(
                original_abs_path,
                format=self.OUTPUT_FORMAT,
                quality=self.COMPRESSION_QUALITY,
                optimize=True
            )
            
            logger.info(f"Image originale sauvegardée : {original_abs_path}")
            
            # Créer la miniature
            thumbnail = self._create_thumbnail(compressed_image)
            
            # Générer le nom pour la miniature en se basant sur le nom de l'original
            thumbnail_rel_path = original_rel_path.replace('.webp', '_thumb.webp')
            thumbnail_abs_path = original_abs_path.replace('.webp', '_thumb.webp')
            
            # Sauvegarder la miniature
            thumbnail.save(
                thumbnail_abs_path,
                format=self.OUTPUT_FORMAT,
                quality=self.COMPRESSION_QUALITY,
                optimize=True
            )
            
            logger.info(f"Miniature sauvegardée : {thumbnail_abs_path}")
            
            # Générer les URLs
            original_url = self._get_url(original_rel_path)
            thumbnail_url = self._get_url(thumbnail_rel_path)
            
            # Obtenir les tailles des fichiers
            original_size = os.path.getsize(original_abs_path)
            thumbnail_size = os.path.getsize(thumbnail_abs_path)
            
            logger.info(
                f"Traitement terminé - Original : {original_size} bytes, "
                f"Miniature : {thumbnail_size} bytes"
            )
            
            return original_url, thumbnail_url
            
        except Exception as e:
            logger.error(f"Erreur lors du traitement de l'image : {e}")
            raise
    
    def delete_screenshot(self, url: str) -> bool:
        """
        Supprime un screenshot et sa miniature.
        
        Args:
            url: URL du screenshot à supprimer (original ou miniature)
            
        Returns:
            True si la suppression a réussi, False sinon
        """
        try:
            # Extraire le chemin relatif de l'URL
            if url.startswith(self.media_url):
                relative_path = url[len(self.media_url):].lstrip('/')
            else:
                logger.warning(f"URL invalide : {url}")
                return False
            
            # Construire le chemin absolu
            absolute_path = self.media_root / relative_path
            
            # Déterminer si c'est une miniature ou l'original
            is_thumbnail = '_thumb.webp' in str(absolute_path)
            
            if is_thumbnail:
                # Si c'est une miniature, déduire le chemin de l'original
                original_path = Path(str(absolute_path).replace('_thumb.webp', '.webp'))
                thumbnail_path = absolute_path
            else:
                # Si c'est l'original, déduire le chemin de la miniature
                original_path = absolute_path
                thumbnail_path = Path(str(absolute_path).replace('.webp', '_thumb.webp'))
            
            # Supprimer l'original s'il existe
            deleted_count = 0
            if original_path.exists():
                original_path.unlink()
                logger.info(f"Fichier original supprimé : {original_path}")
                deleted_count += 1
            else:
                logger.warning(f"Fichier original non trouvé : {original_path}")
            
            # Supprimer la miniature si elle existe
            if thumbnail_path.exists():
                thumbnail_path.unlink()
                logger.info(f"Miniature supprimée : {thumbnail_path}")
                deleted_count += 1
            else:
                logger.warning(f"Miniature non trouvée : {thumbnail_path}")
            
            return deleted_count > 0
                
        except Exception as e:
            logger.error(f"Erreur lors de la suppression du fichier : {e}")
            return False


# Instance globale du processeur
image_processor = ImageProcessor()

