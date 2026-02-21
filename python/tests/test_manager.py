import pytest
from jats.manager import JatsManager
from jats.tools import JatsAgentTooling

def test_manager_initialization():
    manager = JatsManager()
    schema = manager.get_jats()
    assert schema.version == "1.0.0"
    assert len(schema.columns) == 0
    assert len(schema.rows) == 0

def test_add_column():
    manager = JatsManager()
    col = manager.add_column(name="Name", type="text")
    assert col.id.startswith("col_")
    assert len(manager.get_jats().columns) == 1

def test_add_row():
    manager = JatsManager()
    col = manager.add_column(name="Name", type="text")
    row = manager.add_row({col.id: "Bob"})
    assert len(row.id) == 13
    assert len(manager.get_jats().rows) == 1
    assert row.cells[col.id] == "Bob"

def test_crud_columns():
    manager = JatsManager()
    col = manager.add_column(name="Temp", type="number")
    assert manager.get_column(col.id) is not None
    
    manager.delete_column(col.id)
    assert manager.get_column(col.id) is None

def test_delete_row():
    manager = JatsManager()
    row = manager.add_row({})
    assert len(manager.get_jats().rows) == 1
    manager.delete_row(row.id)
    assert len(manager.get_jats().rows) == 0

def test_agent_tooling():
    manager = JatsManager()
    tools = JatsAgentTooling(manager)
    
    result = tools.tool_add_column("Age", "number")
    assert "Success" in result
    
    desc = tools.describe_table()
    assert "# New Table" in desc
    assert "**Age** (number)" in desc
