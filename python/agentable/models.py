from typing import List, Optional, Any, Dict, Literal
from pydantic import BaseModel, Field, field_validator
import re
import time
import random

# --- Constants ---

BASE36_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"

# --- Utils ---

def encode_base36(value: int, length: int) -> str:
    result = ""
    n = value
    while n > 0:
        result = BASE36_ALPHABET[n % 36] + result
        n = n // 36
    return result.rjust(length, "0")

def random_3_char() -> str:
    return "".join(random.choice(BASE36_ALPHABET) for _ in range(3))

def generate_row_id() -> str:
    timestamp = int(time.time() * 1000)
    return encode_base36(timestamp, 9) + random_3_char()

def generate_col_id() -> str:
    return f"col_{random_3_char()}"

def generate_view_id() -> str:
    return f"view_{random_3_char()}"

def generate_filter_id() -> str:
    return f"flt_{random_3_char()}"



# --- Models ---

class AgentableOption(BaseModel):
    value: str
    color: Optional[str] = None


class AgentableColumnConstraints(BaseModel):
    multiSelect: Optional[bool] = None
    options: Optional[List[AgentableOption]] = None
    required: Optional[bool] = None
    min: Optional[float] = None
    max: Optional[float] = None
    pattern: Optional[str] = None


class AgentableColumnDisplay(BaseModel):
    width: Optional[float] = None


class AgentableColumn(BaseModel):
    id: str = Field(pattern=r"^col_[a-z0-9]{3}$")
    name: str
    type: Literal["text", "number", "select", "date", "boolean", "url"]
    description: Optional[str] = None
    display: Optional[AgentableColumnDisplay] = None
    constraints: Optional[AgentableColumnConstraints] = None


class AgentableFilter(BaseModel):
    id: str = Field(pattern=r"^flt_[a-z0-9]{3}$")
    columnId: str
    operator: Literal["is", "isNot", "contains", "gt", "lt", "isEmpty", "isNotEmpty"]
    value: Any


class AgentableSort(BaseModel):
    columnId: str
    direction: Literal["asc", "desc"]


class AgentableView(BaseModel):
    id: str = Field(pattern=r"^view_[a-z0-9]{3}$")
    name: str
    description: Optional[str] = None
    filters: List[AgentableFilter] = []
    sorts: List[AgentableSort] = []
    hiddenColumns: List[str] = []
    columnOrder: List[str] = []


class AgentableRow(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9]{12}$")
    cells: Dict[str, Any] = {}


class AgentableMetadata(BaseModel):
    title: str
    description: Optional[str] = None

class AgentablePermissions(BaseModel):
    allowAgentRead: Optional[bool] = None
    allowAgentCreate: Optional[bool] = None
    allowAgentUpdate: Optional[bool] = None
    allowAgentDelete: Optional[bool] = None

class AgentablePolicy(BaseModel):
    permissions: Optional[AgentablePermissions] = None


class AgentableSchema(BaseModel):
    schema_url: Optional[str] = Field(default=None, alias="$schema")
    version: Literal["agentable-1.0.0"]
    metadata: AgentableMetadata
    policy: Optional[AgentablePolicy] = None
    columns: List[AgentableColumn] = []
    views: List[AgentableView] = []
    rows: List[AgentableRow] = []
