import pytest
import json
import os
from jats.migrate import validate_jats

FIXTURES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../spec/fixtures"))

def test_valid_fixtures():
    valid_dir = os.path.join(FIXTURES_DIR, "valid")
    for filename in os.listdir(valid_dir):
        if filename.endswith(".json"):
            filepath = os.path.join(valid_dir, filename)
            with open(filepath, "r") as f:
                data = json.load(f)
            # Should not raise
            validate_jats(data)

def test_invalid_fixtures():
    invalid_dir = os.path.join(FIXTURES_DIR, "invalid")
    for filename in os.listdir(invalid_dir):
        if filename.endswith(".json"):
            filepath = os.path.join(invalid_dir, filename)
            with open(filepath, "r") as f:
                data = json.load(f)
            # Should raise ValidationError
            with pytest.raises(Exception):
                validate_jats(data)
