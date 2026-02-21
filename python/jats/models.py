from typing import List, Optional, Any, Dict, Literal
from pydantic import BaseModel, Field, field_validator
import re
import time
import random

# --- Constants ---

CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

# --- Utils ---

def encode_base32(value: int, length: int) -> str:
    result = ""
    n = value
    while n > 0:
        result = CROCKFORD_ALPHABET[n % 32] + result
        n = n // 32
    return result.rjust(length, "0")

def random_3_char() -> str:
    return "".join(random.choice(CROCKFORD_ALPHABET) for _ in range(3))

def generate_row_id() -> str:
    timestamp = int(time.time() * 1000)
    return encode_base32(timestamp, 10) + random_3_char()

def generate_col_id() -> str:
    return f"col_{random_3_char()}"

def generate_view_id() -> str:
    return f"view_{random_3_char()}"

def generate_filter_id() -> str:
    return f"flt_{random_3_char()}"


# --- Models ---

class JatsOption(BaseModel):
    value: str
    color: Optional[str] = None


class JatsColumnConstraints(BaseModel):
    multiSelect: Optional[bool] = None
    options: Optional[List[JatsOption]] = None
    required: Optional[bool] = None
    min: Optional[float] = None
    max: Optional[float] = None
    pattern: Optional[str] = None


class JatsColumnDisplay(BaseModel):
    width: Optional[float] = None


class JatsColumn(BaseModel):
    id: str = Field(pattern=r"^col_[0-9A-Z]{3}$")
    name: str
    type: Literal["text", "number", "select", "date", "boolean", "url"]
    description: Optional[str] = None
    display: Optional[JatsColumnDisplay] = None
    constraints: Optional[JatsColumnConstraints] = None


class JatsFilter(BaseModel):
    id: str = Field(pattern=r"^flt_[0-9A-Z]{3}$")
    columnId: str
    operator: Literal["is", "isNot", "contains", "gt", "lt", "isEmpty", "isNotEmpty"]
    value: Any


class JatsSort(BaseModel):
    columnId: str
    direction: Literal["asc", "desc"]


class JatsView(BaseModel):
    id: str = Field(pattern=r"^view_[0-9A-Z]{3}$")
    name: str
    description: Optional[str] = None
    filters: List[JatsFilter] = []
    sorts: List[JatsSort] = []
    hiddenColumns: List[str] = []
    columnOrder: List[str] = []


class JatsRow(BaseModel):
    id: str # Custom validation logic could be added here for 13 chars base32
    cells: Dict[str, Any] = {}


class JatsMetadata(BaseModel):
    title: str
    description: Optional[str] = None

class JatsPermissions(BaseModel):
    allowAgentRead: Optional[bool] = None
    allowAgentCreate: Optional[bool] = None
    allowAgentUpdate: Optional[bool] = None
    allowAgentDelete: Optional[bool] = None

class JatsPolicy(BaseModel):
    permissions: Optional[JatsPermissions] = None


class JatsSchema(BaseModel):
    version: Literal["1.0.0"]
    metadata: JatsMetadata
    policy: Optional[JatsPolicy] = None
    columns: List[JatsColumn] = []
    views: List[JatsView] = []
    rows: List[JatsRow] = []
