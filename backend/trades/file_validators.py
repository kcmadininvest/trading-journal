"""
Utilitaires de validation stricte des fichiers uploadés.
Protection contre les fichiers malveillants et les uploads non autorisés.
Conforme OWASP Top 10:2025 A03 (Software Supply Chain) et A10 (Exceptional Conditions).
"""
import os
import hashlib
import csv
from io import StringIO
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _
from django.core.cache import cache
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

# Limites strictes pour les uploads CSV (OWASP A03:2025)
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB (réduit de 10 MB)
MAX_CSV_ROWS = 10000  # Limite de lignes pour éviter DoS
MAX_CSV_COLUMNS = 50  # Limite de colonnes
MAX_CELL_LENGTH = 1000  # Limite de caractères par cellule

# Extensions autorisées
ALLOWED_EXTENSIONS = ['.csv']

# Rate limiting pour les uploads (par utilisateur)
UPLOAD_RATE_LIMIT_KEY = 'csv_upload_rate_limit_{user_id}'
UPLOAD_MAX_PER_HOUR = 20  # Maximum 20 uploads CSV par heure par utilisateur


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
    
    def calculate_checksum(self, file):
        """
        Calcule le checksum SHA-256 du fichier pour vérification d'intégrité.
        
        Args:
            file: Objet fichier Django
            
        Returns:
            str: Checksum SHA-256 en hexadécimal
        """
        try:
            file.seek(0)
            sha256_hash = hashlib.sha256()
            
            for chunk in iter(lambda: file.read(4096), b''):
                sha256_hash.update(chunk)
            
            file.seek(0)
            checksum = sha256_hash.hexdigest()
            
            logger.info(f"Checksum calculé pour {file.name}: {checksum}")
            return checksum
        
        except Exception as e:
            logger.error(f"Erreur lors du calcul du checksum: {str(e)}")
            raise ValidationError(_("Impossible de calculer le checksum du fichier."))
    
    def validate_csv_structure(self, file):
        """
        Valide la structure du CSV (nombre de lignes, colonnes, cellules).
        Protection contre les attaques DoS via fichiers CSV malformés.
        """
        try:
            file.seek(0)
            content = file.read().decode('utf-8-sig')
            file.seek(0)
            
            csv_reader = csv.reader(StringIO(content))
            
            row_count = 0
            max_columns = 0
            
            for row_num, row in enumerate(csv_reader, start=1):
                row_count += 1
                
                if row_count > MAX_CSV_ROWS:
                    raise ValidationError(
                        _("Le fichier CSV contient trop de lignes. Maximum autorisé: %(max_rows)d"),
                        params={'max_rows': MAX_CSV_ROWS}
                    )
                
                if len(row) > MAX_CSV_COLUMNS:
                    raise ValidationError(
                        _("Le fichier CSV contient trop de colonnes. Maximum autorisé: %(max_cols)d"),
                        params={'max_cols': MAX_CSV_COLUMNS}
                    )
                
                max_columns = max(max_columns, len(row))
                
                for cell_num, cell in enumerate(row, start=1):
                    if len(cell) > MAX_CELL_LENGTH:
                        raise ValidationError(
                            _("Une cellule du CSV est trop longue (ligne %(row)d, colonne %(col)d). Maximum: %(max_len)d caractères"),
                            params={'row': row_num, 'col': cell_num, 'max_len': MAX_CELL_LENGTH}
                        )
            
            if row_count == 0:
                raise ValidationError(_("Le fichier CSV est vide."))
            
            logger.info(f"Structure CSV validée: {row_count} lignes, {max_columns} colonnes max")
        
        except csv.Error as e:
            logger.warning(f"Erreur de parsing CSV: {str(e)}")
            raise ValidationError(
                _("Le fichier CSV est malformé ou corrompu: %(error)s"),
                params={'error': str(e)}
            )
        except UnicodeDecodeError as e:
            logger.warning(f"Erreur d'encodage CSV: {str(e)}")
            raise ValidationError(_("L'encodage du fichier CSV n'est pas valide. Utilisez UTF-8."))
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Erreur inattendue lors de la validation de la structure CSV: {str(e)}")
            raise ValidationError(_("Impossible de valider la structure du fichier CSV."))
    
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
            file_content = file.read(1024)
            file.seek(0)
            
            has_csv_magic = any(file_content.startswith(mb) for mb in CSV_MAGIC_BYTES)
            
            if not has_csv_magic:
                try:
                    file_content.decode('utf-8')
                except UnicodeDecodeError:
                    try:
                        file_content.decode('latin-1')
                    except UnicodeDecodeError:
                        raise ValidationError(
                            _("Le fichier ne semble pas être un fichier texte valide.")
                        )
            
            suspicious_chars = [b'\x00', b'\x01', b'\x02', b'\x03']
            for char in suspicious_chars:
                if char in file_content[:100]:
                    raise ValidationError(
                        _("Le fichier contient des caractères suspects et n'est pas autorisé.")
                    )
        
        except ValidationError:
            raise
        except Exception as e:
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
    
    def check_upload_rate_limit(self, user_id):
        """
        Vérifie le rate limiting pour les uploads (OWASP A06:2025 - Insecure Design).
        """
        cache_key = UPLOAD_RATE_LIMIT_KEY.format(user_id=user_id)
        upload_count = cache.get(cache_key, 0)
        
        if upload_count >= UPLOAD_MAX_PER_HOUR:
            logger.warning(f"Rate limit dépassé pour l'utilisateur {user_id}: {upload_count} uploads")
            raise ValidationError(
                _("Trop de fichiers uploadés. Limite: %(max)d fichiers par heure."),
                params={'max': UPLOAD_MAX_PER_HOUR}
            )
        
        cache.set(cache_key, upload_count + 1, 3600)
    
    def validate(self, file, user_id=None, verify_csv_structure=True):
        """
        Valide complètement un fichier uploadé avec vérification d'intégrité.
        Conforme OWASP Top 10:2025 A03 (Supply Chain) et A08 (Data Integrity).
        
        Returns:
            dict: Métadonnées de validation incluant le checksum
        """
        if user_id:
            self.check_upload_rate_limit(user_id)
        
        self.validate_filename(file.name)
        self.validate_extension(file.name)
        self.validate_size(file)
        self.validate_mime_type(file)
        self.validate_content(file)
        
        checksum = self.calculate_checksum(file)
        
        if verify_csv_structure and file.name.lower().endswith('.csv'):
            self.validate_csv_structure(file)
        
        logger.info(f"Fichier validé avec succès: {file.name} ({file.size} bytes, checksum: {checksum[:16]}...)")
        
        return {
            'filename': file.name,
            'size': file.size,
            'checksum': checksum,
            'validated': True
        }


# Instance globale pour les fichiers CSV
csv_file_validator = FileValidator(
    allowed_extensions=['.csv'],
    allowed_mime_types=ALLOWED_CSV_MIME_TYPES,
    max_size=MAX_FILE_SIZE
)

