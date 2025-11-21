"""
Utilitaires de validation stricte des fichiers uploadés.
Protection contre les fichiers malveillants et les uploads non autorisés.
"""
import os
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
import logging

# Essayer d'importer python-magic (optionnel)
try:
    import magic
    MAGIC_AVAILABLE = True
except ImportError:
    MAGIC_AVAILABLE = False

logger = logging.getLogger(__name__)


# Types MIME autorisés pour les fichiers CSV
ALLOWED_CSV_MIME_TYPES = [
    'text/csv',
    'text/plain',
    'application/csv',
    'text/x-csv',
    'application/vnd.ms-excel',  # Excel peut générer des CSV avec ce MIME
]

# Magic bytes pour les fichiers CSV (premiers octets du fichier)
CSV_MAGIC_BYTES = [
    b'\xef\xbb\xbf',  # UTF-8 BOM
    b'\xff\xfe',      # UTF-16 LE BOM
    b'\xfe\xff',      # UTF-16 BE BOM
]

# Taille maximale des fichiers (10 MB)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Extensions autorisées
ALLOWED_EXTENSIONS = ['.csv']


class FileValidator:
    """
    Validateur strict pour les fichiers uploadés.
    """
    
    def __init__(self, allowed_extensions=None, allowed_mime_types=None, max_size=None):
        """
        Initialise le validateur.
        
        Args:
            allowed_extensions: Liste des extensions autorisées (ex: ['.csv', '.txt'])
            allowed_mime_types: Liste des types MIME autorisés
            max_size: Taille maximale en octets
        """
        self.allowed_extensions = allowed_extensions or ALLOWED_EXTENSIONS
        self.allowed_mime_types = allowed_mime_types or ALLOWED_CSV_MIME_TYPES
        self.max_size = max_size or MAX_FILE_SIZE
    
    def validate_extension(self, filename):
        """
        Valide l'extension du fichier.
        
        Args:
            filename: Nom du fichier
            
        Raises:
            ValidationError: Si l'extension n'est pas autorisée
        """
        if not filename:
            raise ValidationError(_("Le nom du fichier est requis."))
        
        # Extraire l'extension
        _, ext = os.path.splitext(filename.lower())
        
        if ext not in self.allowed_extensions:
            raise ValidationError(
                _("Extension de fichier non autorisée. Extensions autorisées: %(extensions)s"),
                params={'extensions': ', '.join(self.allowed_extensions)}
            )
    
    def validate_size(self, file):
        """
        Valide la taille du fichier.
        
        Args:
            file: Objet fichier Django
            
        Raises:
            ValidationError: Si le fichier est trop volumineux
        """
        if file.size > self.max_size:
            max_size_mb = self.max_size / (1024 * 1024)
            raise ValidationError(
                _("Le fichier est trop volumineux. Taille maximale autorisée: %(max_size).1f MB"),
                params={'max_size': max_size_mb}
            )
    
    def validate_mime_type(self, file):
        """
        Valide le type MIME réel du fichier.
        
        Args:
            file: Objet fichier Django
            
        Raises:
            ValidationError: Si le type MIME n'est pas autorisé
        """
        try:
            # Lire les premiers octets pour déterminer le type MIME réel
            file.seek(0)
            file_content = file.read(1024)  # Lire les 1024 premiers octets
            file.seek(0)  # Remettre le curseur au début
            
            # Utiliser python-magic pour détecter le type MIME réel si disponible
            if MAGIC_AVAILABLE:
                try:
                    mime_type = magic.from_buffer(file_content, mime=True)
                except (AttributeError, TypeError, Exception) as e:
                    logger.warning(f"Erreur lors de la détection MIME avec python-magic: {str(e)}")
                    # Fallback sur la méthode alternative
                    mime_type = self._detect_mime_type_fallback(file_content)
            else:
                # Utiliser une méthode alternative si python-magic n'est pas disponible
                mime_type = self._detect_mime_type_fallback(file_content)
            
            # Normaliser le type MIME (enlever les paramètres)
            mime_type = mime_type.split(';')[0].strip().lower()
            
            # Vérifier si le type MIME est autorisé
            allowed_normalized = [mime.lower().strip() for mime in self.allowed_mime_types]
            
            if mime_type not in allowed_normalized:
                logger.warning(
                    f"Type MIME non autorisé détecté: {mime_type} "
                    f"pour le fichier {file.name}"
                )
                raise ValidationError(
                    _("Type de fichier non autorisé. Type détecté: %(mime_type)s"),
                    params={'mime_type': mime_type}
                )
        
        except Exception as e:
            if isinstance(e, ValidationError):
                raise
            logger.error(f"Erreur lors de la validation du type MIME: {str(e)}")
            raise ValidationError(_("Impossible de valider le type de fichier."))
    
    def _detect_mime_type_fallback(self, file_content):
        """
        Méthode de fallback pour détecter le type MIME sans python-magic.
        
        Args:
            file_content: Contenu du fichier (premiers octets)
            
        Returns:
            str: Type MIME détecté
        """
        # Vérifier les magic bytes pour CSV
        if any(file_content.startswith(mb) for mb in CSV_MAGIC_BYTES):
            return 'text/csv'
        
        # Vérifier si c'est du texte (CSV)
        try:
            file_content.decode('utf-8')
            return 'text/plain'
        except UnicodeDecodeError:
            try:
                file_content.decode('latin-1')
                return 'text/plain'
            except UnicodeDecodeError:
                raise ValidationError(_("Le fichier n'est pas un fichier texte valide."))
    
    def validate_content(self, file):
        """
        Valide le contenu du fichier (magic bytes, structure de base).
        
        Args:
            file: Objet fichier Django
            
        Raises:
            ValidationError: Si le contenu est suspect
        """
        try:
            file.seek(0)
            file_content = file.read(1024)  # Lire les 1024 premiers octets
            file.seek(0)  # Remettre le curseur au début
            
            # Vérifier les magic bytes pour CSV
            has_csv_magic = any(file_content.startswith(mb) for mb in CSV_MAGIC_BYTES)
            
            # Si pas de magic bytes, vérifier que c'est du texte
            if not has_csv_magic:
                try:
                    # Essayer de décoder en UTF-8
                    file_content.decode('utf-8')
                except UnicodeDecodeError:
                    try:
                        # Essayer en latin-1
                        file_content.decode('latin-1')
                    except UnicodeDecodeError:
                        raise ValidationError(
                            _("Le fichier ne semble pas être un fichier texte valide.")
                        )
            
            # Vérifier qu'il n'y a pas de caractères suspects (scripts, binaires)
            # Vérifier la présence de caractères de contrôle non autorisés
            suspicious_chars = [b'\x00', b'\x01', b'\x02', b'\x03']
            for char in suspicious_chars:
                if char in file_content[:100]:  # Vérifier les 100 premiers octets
                    raise ValidationError(
                        _("Le fichier contient des caractères suspects et n'est pas autorisé.")
                    )
        
        except Exception as e:
            if isinstance(e, ValidationError):
                raise
            logger.error(f"Erreur lors de la validation du contenu: {str(e)}")
            raise ValidationError(_("Impossible de valider le contenu du fichier."))
    
    def validate_filename(self, filename):
        """
        Valide le nom du fichier (sécurité contre les path traversal).
        
        Args:
            filename: Nom du fichier
            
        Raises:
            ValidationError: Si le nom de fichier est suspect
        """
        if not filename:
            raise ValidationError(_("Le nom du fichier est requis."))
        
        # Vérifier les tentatives de path traversal
        dangerous_patterns = ['..', '/', '\\', '\x00']
        for pattern in dangerous_patterns:
            if pattern in filename:
                logger.warning(f"Tentative de path traversal détectée: {filename}")
                raise ValidationError(
                    _("Le nom du fichier contient des caractères non autorisés.")
                )
        
        # Vérifier la longueur du nom de fichier
        if len(filename) > 255:
            raise ValidationError(_("Le nom du fichier est trop long."))
    
    def validate(self, file):
        """
        Valide complètement un fichier uploadé.
        
        Args:
            file: Objet fichier Django
            
        Raises:
            ValidationError: Si le fichier n'est pas valide
        """
        # Valider le nom du fichier
        self.validate_filename(file.name)
        
        # Valider l'extension
        self.validate_extension(file.name)
        
        # Valider la taille
        self.validate_size(file)
        
        # Valider le type MIME
        self.validate_mime_type(file)
        
        # Valider le contenu
        self.validate_content(file)
        
        logger.info(f"Fichier validé avec succès: {file.name} ({file.size} bytes)")


# Instance globale pour les fichiers CSV
csv_file_validator = FileValidator(
    allowed_extensions=['.csv'],
    allowed_mime_types=ALLOWED_CSV_MIME_TYPES,
    max_size=MAX_FILE_SIZE
)

