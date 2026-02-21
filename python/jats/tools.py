from typing import Any, Dict, List, Type, Optional
from pydantic import BaseModel, create_model, Field
from .manager import JatsManager
from .models import JatsColumn

class JatsAgentTooling:
    def __init__(self, manager: JatsManager):
        self.manager = manager

    def describe_table(self) -> str:
        """
        "The Eyes": Returns a markdown description of the table state.
        """
        schema = self.manager.get_jats()
        meta = schema.metadata
        
        output = f"# {meta.title}\n{meta.description or ''}\n\n"
        
        output += "## Columns\n"
        for col in schema.columns:
            output += f"- **{col.name}** ({col.type}) [ID: {col.id}] \n"
            if col.description:
                output += f"  - Description: {col.description}\n"
            if col.constraints and col.constraints.options:
                options = ", ".join([o.value for o in col.constraints.options])
                output += f"  - Options: {options}\n"

        output += "\n## Views\n"
        if not schema.views:
            output += "(No views defined)\n"
        else:
            for view in schema.views:
                output += f"- **{view.name}** [ID: {view.id}]\n"

        output += f"\n## Row Count: {len(schema.rows)}\n"

        return output

    def generate_row_model(self) -> Type[BaseModel]:
        """
        Dynamically builds a Pydantic model for row creation based on current columns.
        """
        schema = self.manager.get_jats()
        fields: Dict[str, Any] = {}
        
        for col in schema.columns:
            # Map JATS types to Python types
            field_type: Any = str
            if col.type == "number":
                field_type = float
            elif col.type == "boolean":
                field_type = bool
            elif col.type == "date":
                field_type = str
            elif col.type == "url":
                field_type = str
            elif col.type == "select":
                # For simplicity, treating select as str or List[str]
                if col.constraints and col.constraints.multiSelect:
                    field_type = List[str]
                else:
                    field_type = str

            # Description
            description = f"Column: {col.name}"
            if col.description:
                description += f" - {col.description}"
            
            # Constraints / Optionality
            # Defaulting to optional unless explicitly required, to allow flexbility
            if col.constraints and col.constraints.required:
                fields[col.id] = (field_type, Field(..., description=description))
            else:
                fields[col.id] = (Optional[field_type], Field(None, description=description))

        # Create Dynamic Model
        # model_config={"extra": "forbid"} ensures strict validation
        DynamicRowModel = create_model(
            "DynamicRowModel",
            __config__={"extra": "forbid"}, 
            **fields
        )
        
        return DynamicRowModel

    def format_openai(self, name: str = "add_row", description: str = "Add a new row to the table. Use column IDs as keys.") -> Dict[str, Any]:
        """
        Returns an OpenAI-compatible tool definition (Strict Mode).
        """
        model = self.generate_row_model()
        json_schema = model.model_json_schema()
        
        # Pydantic's json_schema might include 'title', 'defs', etc. 
        # OpenAI strict mode requires specific structure and no additionalProperties
        # But simply setting strict=True in the tool definition and creating the model with extra="forbid" usually works.
        
        return {
            "type": "function",
            "function": {
                "name": name,
                "description": description,
                "parameters": json_schema,
                "strict": True
            }
        }

    def format_anthropic(self, name: str = "add_row", description: str = "Add a new row to the table.") -> Dict[str, Any]:
        """
        Returns an Anthropic-compatible tool definition.
        """
        model = self.generate_row_model()
        json_schema = model.model_json_schema()
        
        # Remove $defs if present and empty, or resolve refs if complex.
        # For this flat model, it should be simple.
        
        return {
            "name": name,
            "description": description,
            "input_schema": json_schema
        }

    # --- Legacy / Internal Tools ---

    def tool_add_column(self, name: str, type: str, description: Optional[str] = None) -> str:
        try:
            col = self.manager.add_column(name=name, type=type, description=description)
            return f"Success: Added column \"{col.name}\" with ID {col.id}"
        except Exception as e:
            return f"Error: {str(e)}"

    def tool_add_row(self, cells: Dict[str, Any]) -> str:
        try:
            # Here we could validate `cells` against `generate_row_model()` if we wanted strictly enforced types
            # before passing to manager. For now, JatsManager does its own checking/storage.
            row = self.manager.add_row(cells)
            return f"Success: Added row with ID {row.id}"
        except Exception as e:
            return f"Error: {str(e)}"
    
    def tool_delete_row(self, row_id: str) -> str:
        try:
            self.manager.delete_row(row_id)
            return f"Success: Deleted row {row_id}"
        except Exception as e:
            return f"Error: {str(e)}"
