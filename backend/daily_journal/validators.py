from django.core.exceptions import ValidationError
from trades.image_validators import image_validator


def validate_journal_image(file) -> None:
    """
    Valide un fichier image pour le journal quotidien.
    """
    try:
        image_validator.validate(file)
    except ValidationError:
        raise
