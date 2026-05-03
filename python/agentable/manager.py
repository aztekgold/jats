from typing import Any, Dict, List, Optional
from .models import (
    AgentableSchema, AgentableColumn, AgentableRow, AgentableView,
    AgentableFilter, AgentableSort,
    AgentableMetadata, generate_row_id, generate_col_id, generate_view_id,
    generate_filter_id, generate_sort_id
)

class AgentableManager:
    def __init__(self, initial_schema: Optional[Dict[str, Any]] = None):
        if initial_schema:
            # Validate and load provided schema
            # Pydantic will handle validation and default values where possible
            if "version" not in initial_schema:
                initial_schema["version"] = "agentable-1.0.0"
            if "$schema" not in initial_schema:
                initial_schema["$schema"] = "https://raw.githubusercontent.com/aztekgold/agentable/main/schema.json"
            self.schema = AgentableSchema(**initial_schema)
        else:
            self.schema = AgentableSchema(
                schema_url="https://raw.githubusercontent.com/aztekgold/agentable/main/schema.json",
                version="agentable-1.0.0",
                metadata=AgentableMetadata(
                    title="New Table",
                    description="Created by AgentableManager (Python)"
                ),
                columns=[],
                views=[],
                rows=[]
            )

    def get_agentable(self) -> AgentableSchema:
        return self.schema
    
    def to_dict(self) -> Dict[str, Any]:
        return self.schema.model_dump()

    # --- Metadata Management ---

    def update_metadata(self, title: Optional[str] = None, description: Optional[str] = None) -> None:
        if title is not None:
            self.schema.metadata.title = title
        if description is not None:
            self.schema.metadata.description = description

    # --- Column Management ---

    def add_column(self, name: str, type: str, **kwargs) -> AgentableColumn:
        new_id = generate_col_id()
        while any(c.id == new_id for c in self.schema.columns):
            new_id = generate_col_id()

        new_col = AgentableColumn(
            id=new_id,
            name=name,
            type=type, # type: ignore - validated by Pydantic
            **kwargs
        )
        self.schema.columns.append(new_col)
        return new_col

    def get_column(self, id: str) -> Optional[AgentableColumn]:
        for col in self.schema.columns:
            if col.id == id:
                return col
        return None

    def update_column(self, id: str, **kwargs) -> AgentableColumn:
        col = self.get_column(id)
        if not col:
            raise ValueError(f"Column {id} not found")
        
        # Omit ID from updates
        data = kwargs.copy()
        data.pop("id", None)
        
        for key, value in data.items():
            if hasattr(col, key):
                setattr(col, key, value)
        
        return col

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

    def add_row(self, cells: Dict[str, Any]) -> AgentableRow:
        new_id = generate_row_id()
        while any(r.id == new_id for r in self.schema.rows):
            new_id = generate_row_id()

        new_row = AgentableRow(
            id=new_id,
            cells=cells
        )
        self.schema.rows.append(new_row)
        return new_row

    def update_row(self, id: str, cells: Dict[str, Any]) -> AgentableRow:
        for row in self.schema.rows:
            if row.id == id:
                row.cells.update(cells)
                return row
        raise ValueError(f"Row {id} not found")

    def delete_row(self, id: str) -> None:
        self.schema.rows = [r for r in self.schema.rows if r.id != id]

    def move_row(self, id: str, to_index: int) -> None:
        from_index = -1
        for i, row in enumerate(self.schema.rows):
            if row.id == id:
                from_index = i
                break
        
        if from_index == -1:
            raise ValueError(f"Row {id} not found")
        
        row = self.schema.rows.pop(from_index)
        self.schema.rows.insert(to_index, row)

    def set_column_visibility(self, view_id: str, column_id: str, visible: bool) -> None:
        view = self.get_view(view_id)
        if not view:
            raise ValueError(f"View {view_id} not found")
        
        if visible:
            view.hiddenColumns = [cid for cid in view.hiddenColumns if cid != column_id]
        else:
            if column_id not in view.hiddenColumns:
                view.hiddenColumns.append(column_id)

    # --- View Management ---

    def create_view(self, name: str) -> AgentableView:
        new_id = generate_view_id()
        while any(v.id == new_id for v in self.schema.views):
            new_id = generate_view_id()

        new_view = AgentableView(
            id=new_id,
            name=name,
            filters=[],
            sorts=[],
            hiddenColumns=[],
            columnOrder=[c.id for c in self.schema.columns]
        )
        self.schema.views.append(new_view)
        return new_view

    def get_view(self, id: str) -> Optional[AgentableView]:
        for view in self.schema.views:
            if view.id == id:
                return view
        return None

    def update_view(self, id: str, **kwargs) -> AgentableView:
        view = self.get_view(id)
        if not view:
            raise ValueError(f"View {id} not found")
        
        # Omit ID, filters, and sorts from direct updates
        data = kwargs.copy()
        data.pop("id", None)
        data.pop("filters", None)
        data.pop("sorts", None)
        
        for key, value in data.items():
            if hasattr(view, key):
                setattr(view, key, value)
        
        return view

    def add_filter(self, view_id: str, column_id: str, operator: str, value: Any) -> AgentableFilter:
        view = self.get_view(view_id)
        if not view:
            raise ValueError(f"View {view_id} not found")
        
        new_id = generate_filter_id()
        while any(f.id == new_id for f in view.filters):
            new_id = generate_filter_id()
        
        new_filter = AgentableFilter(
            id=new_id,
            columnId=column_id,
            operator=operator, # type: ignore
            value=value
        )
        view.filters.append(new_filter)
        return new_filter

    def remove_filter(self, view_id: str, filter_id: str) -> None:
        view = self.get_view(view_id)
        if not view:
            raise ValueError(f"View {view_id} not found")
        view.filters = [f for f in view.filters if f.id != filter_id]

    def add_sort(self, view_id: str, column_id: str, direction: str) -> AgentableSort:
        view = self.get_view(view_id)
        if not view:
            raise ValueError(f"View {view_id} not found")
        
        new_id = generate_sort_id()
        while any(s.id == new_id for s in view.sorts):
            new_id = generate_sort_id()
        
        new_sort = AgentableSort(
            id=new_id,
            columnId=column_id,
            direction=direction # type: ignore
        )
        view.sorts.append(new_sort)
        return new_sort

    def remove_sort(self, view_id: str, sort_id: str) -> None:
        view = self.get_view(view_id)
        if not view:
            raise ValueError(f"View {view_id} not found")
        view.sorts = [s for s in view.sorts if s.id != sort_id]
