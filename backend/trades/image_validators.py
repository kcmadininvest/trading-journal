"""
Validateurs pour les fichiers images uploadés.
Validation stricte pour assurer la sécurité et la qualité des images.
"""

import os
import magic
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile
from PIL import Image
from io import BytesIO
import logging

logger = logging.getLogger(__name__)


class ImageValidator:
    """
    Validateur strict pour les fichiers images.
    Vérifie le type MIME, les magic bytes, la taille et les dimensions.
    """
    
    # Types MIME autorisés
    ALLOWED_MIME_TYPES = {
        'image/jpeg',
        'image/png',
        'image/webp',
    }
    
    # Extensions autorisées
    ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
    
    # Magic bytes pour chaque type d'image
    MAGIC_BYTES = {
        'image/jpeg': [b'\xFF\xD8\xFF'],
        'image/png': [b'\x89\x50\x4E\x47\x0D\x0A\x1A\x0A'],
        'image/webp': [b'RIFF', b'WEBP'],
    }
    
    # Taille maximale : 5 MB
    MAX_FILE_SIZE = 5 * 1024 * 1024
    
    # Dimensions minimales et maximales
    MIN_WIDTH = 100
    MIN_HEIGHT = 100
    MAX_WIDTH = 10000
    MAX_HEIGHT = 10000
    
    def __init__(self):
        """Initialise le validateur."""
        self.mime = magic.Magic(mime=True)
    
    def validate(self, file: UploadedFile) -> None:
        """
        Valide un fichier image uploadé.
        
        Args:
            file: Le fichier uploadé à valider
            
        Raises:
            ValidationError: Si le fichier ne passe pas la validation
        """
        # 1. Vérifier que le fichier existe et a un nom
        if not file or not file.name:
            raise ValidationError("Aucun fichier fourni")
        
        # 2. Vérifier la taille du fichier
        if file.size > self.MAX_FILE_SIZE:
            size_mb = self.MAX_FILE_SIZE / (1024 * 1024)
            raise ValidationError(
                f"Le fichier est trop volumineux. Taille maximale : {size_mb} MB"
            )
        
        if file.size == 0:
            raise ValidationError("Le fichier est vide")
        
        # 3. Vérifier l'extension
        file_ext = os.path.splitext(file.name)[1].lower()
        if file_ext not in self.ALLOWED_EXTENSIONS:
            raise ValidationError(
                f"Extension de fichier non autorisée. Extensions autorisées : "
                f"{', '.join(self.ALLOWED_EXTENSIONS)}"
            )
        
        # 4. Protection contre path traversal
        if '..' in file.name or '/' in file.name or '\\' in file.name:
            raise ValidationError("Nom de fichier invalide")
        
        # 5. Lire le contenu du fichier
        try:
            file.seek(0)
            file_content = file.read()
            file.seek(0)  # Remettre le curseur au début
        except Exception as e:
            logger.error(f"Erreur lors de la lecture du fichier : {e}")
            raise ValidationError("Impossible de lire le fichier")
        
        # 6. Vérifier le type MIME réel avec python-magic
        try:
            detected_mime = self.mime.from_buffer(file_content)
            if detected_mime not in self.ALLOWED_MIME_TYPES:
                raise ValidationError(
                    f"Type de fichier non autorisé : {detected_mime}. "
                    f"Types autorisés : {', '.join(self.ALLOWED_MIME_TYPES)}"
                )
        except Exception as e:
            logger.error(f"Erreur lors de la détection du type MIME : {e}")
            raise ValidationError("Impossible de déterminer le type de fichier")
        
        # 7. Vérifier les magic bytes
        magic_bytes_valid = False
        for magic_byte_list in self.MAGIC_BYTES.get(detected_mime, []):
            if file_content.startswith(magic_byte_list):
                magic_bytes_valid = True
                break
        
        if not magic_bytes_valid:
            raise ValidationError("Le fichier ne correspond pas au format attendu")
        
        # 8. Valider l'image avec Pillow
        try:
            image = Image.open(BytesIO(file_content))
            image.verify()  # Vérifier l'intégrité de l'image
            
            # Rouvrir l'image après verify() car elle est fermée
            image = Image.open(BytesIO(file_content))
            
            # Vérifier les dimensions
            width, height = image.size
            
            if width < self.MIN_WIDTH or height < self.MIN_HEIGHT:
                raise ValidationError(
                    f"L'image est trop petite. Dimensions minimales : "
                    f"{self.MIN_WIDTH}x{self.MIN_HEIGHT}px"
                )
            
            if width > self.MAX_WIDTH or height > self.MAX_HEIGHT:
                raise ValidationError(
                    f"L'image est trop grande. Dimensions maximales : "
                    f"{self.MAX_WIDTH}x{self.MAX_HEIGHT}px"
                )
            
            # Vérifier le format
            if image.format.lower() not in ['jpeg', 'png', 'webp']:
                raise ValidationError(
                    f"Format d'image non supporté : {image.format}"
                )
            
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Erreur lors de la validation de l'image avec Pillow : {e}")
            raise ValidationError("Le fichier n'est pas une image valide")
        
        logger.info(
            f"Fichier validé avec succès : {file.name} "
            f"({file.size} bytes, {width}x{height}px, {detected_mime})"
        )


# Instance globale du validateur
image_validator = ImageValidator()

