from typing import Any, Dict
from .models import AgentableSchema

def validate_agentable(data: Dict[str, Any]) -> AgentableSchema:
    """
    Validates a dictionary against the AGENTABLE Pydantic model.
    Raises pydantic.ValidationError if invalid.
    """
    return AgentableSchema(**data)

def migrate_agentable(data: Dict[str, Any]) -> AgentableSchema:
    """
    Migrates a raw dictionary to the latest AGENTABLE schema version.
    """
    if not isinstance(data, dict):
        raise ValueError("Invalid AGENTABLE data: Input must be a dictionary.")

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
    return validate_agentable(data)
