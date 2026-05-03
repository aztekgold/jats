from .models import (
    AgentableSchema, AgentableColumn, AgentableRow, AgentableView, AgentableSort, AgentableFilter,
    generate_row_id, generate_col_id, generate_view_id, generate_filter_id, generate_sort_id
)
from .manager import AgentableManager
from .migrate import validate_agentable, migrate_agentable
from .tools import AgentableAgentTooling

__all__ = [
    "AgentableSchema",
    "AgentableColumn", 
    "AgentableRow",
    "AgentableView",
    "AgentableSort",
    "AgentableFilter",
    "AgentableManager",
    "validate_agentable",
    "migrate_agentable",
    "AgentableAgentTooling",
    "generate_row_id",
    "generate_col_id",
    "generate_view_id",
    "generate_filter_id",
    "generate_sort_id",
    "create_table"
]

def create_table(initial_schema=None):
    return AgentableManager(initial_schema)
