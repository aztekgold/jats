from typing import Any, Dict, List, Optional
from .models import (
    JatsSchema, JatsColumn, JatsRow, JatsView,
    JatsMetadata, generate_row_id, generate_col_id, generate_view_id
)

class JatsManager:
    def __init__(self, initial_schema: Optional[Dict[str, Any]] = None):
        if initial_schema:
            # Validate and load provided schema
            # Pydantic will handle validation and default values where possible
            if "version" not in initial_schema:
                initial_schema["version"] = "jats-1.0.0"
            if "$schema" not in initial_schema:
                initial_schema["$schema"] = "https://raw.githubusercontent.com/aztekgold/jats/main/schema.json"
            self.schema = JatsSchema(**initial_schema)
        else:
            self.schema = JatsSchema(
                schema_url="https://raw.githubusercontent.com/aztekgold/jats/main/schema.json",
                version="jats-1.0.0",
                metadata=JatsMetadata(
                    title="New Table",
                    description="Created by JatsManager (Python)"
                ),
                columns=[],
                views=[],
                rows=[]
            )

    def get_jats(self) -> JatsSchema:
        return self.schema
    
    def to_dict(self) -> Dict[str, Any]:
        return self.schema.model_dump()

    # --- Column Management ---

    def add_column(self, name: str, type: str, **kwargs) -> JatsColumn:
        new_id = generate_col_id()
        while any(c.id == new_id for c in self.schema.columns):
            new_id = generate_col_id()

        new_col = JatsColumn(
            id=new_id,
            name=name,
            type=type, # type: ignore - validated by Pydantic
            **kwargs
        )
        self.schema.columns.append(new_col)
        return new_col

    def get_column(self, id: str) -> Optional[JatsColumn]:
        for col in self.schema.columns:
            if col.id == id:
                return col
        return None

    def delete_column(self, id: str) -> None:
        self.schema.columns = [c for c in self.schema.columns if c.id != id]
        # Cleanup rows
        for row in self.schema.rows:
            if id in row.cells:
                del row.cells[id]
        # Cleanup views
        for view in self.schema.views:
            view.filters = [f for f in view.filters if f.columnId != id]
            view.sorts = [s for s in view.sorts if s.columnId != id]
            view.hiddenColumns = [cid for cid in view.hiddenColumns if cid != id]
            view.columnOrder = [cid for cid in view.columnOrder if cid != id]

    # --- Row Management ---

    def add_row(self, cells: Dict[str, Any]) -> JatsRow:
        new_id = generate_row_id()
        while any(r.id == new_id for r in self.schema.rows):
            new_id = generate_row_id()

        new_row = JatsRow(
            id=new_id,
            cells=cells
        )
        self.schema.rows.append(new_row)
        return new_row

    def delete_row(self, id: str) -> None:
        self.schema.rows = [r for r in self.schema.rows if r.id != id]

    # --- View Management ---

    def create_view(self, name: str) -> JatsView:
        new_id = generate_view_id()
        while any(v.id == new_id for v in self.schema.views):
            new_id = generate_view_id()

        new_view = JatsView(
            id=new_id,
            name=name,
            filters=[],
            sorts=[],
            hiddenColumns=[],
            columnOrder=[c.id for c in self.schema.columns]
        )
        self.schema.views.append(new_view)
        return new_view
