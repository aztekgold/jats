from typing import Any, Dict
from .models import JatsSchema

def validate_jats(data: Dict[str, Any]) -> JatsSchema:
    """
    Validates a dictionary against the JATS Pydantic model.
    Raises pydantic.ValidationError if invalid.
    """
    return JatsSchema(**data)

def migrate_jats(data: Dict[str, Any]) -> JatsSchema:
    """
    Migrates a raw dictionary to the latest JATS schema version.
    """
    if not isinstance(data, dict):
        raise ValueError("Invalid JATS data: Input must be a dictionary.")

    # 1. Ensure version exists
    if "version" not in data:
        data["version"] = "1.0.0"

    # 2. Ensure basic structure
    if "columns" not in data:
        data["columns"] = []
    if "views" not in data:
        data["views"] = []
    if "rows" not in data:
        data["rows"] = []
    if "metadata" not in data:
        data["metadata"] = {"title": "Migrated Table"}
    
    # 3. Validate
    return validate_jats(data)
