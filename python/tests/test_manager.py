import pytest
from unittest.mock import patch
from jats.manager import JatsManager
from jats.tools import JatsAgentTooling

def test_manager_initialization():
    manager = JatsManager()
    schema = manager.get_jats()
    assert schema.version == "jats-1.0.0"
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
    assert len(row.id) == 12
    assert len(manager.get_jats().rows) == 1
    assert row.cells[col.id] == "Bob"

def test_prevent_col_id_collision():
    manager = JatsManager()
    
    # Mock to return the same ID twice, then a new one
    with patch('jats.manager.generate_col_id', side_effect=["col_123", "col_123", "col_456"]):
        manager.add_column(name="Col 1", type="text")
        
        # This insertion would collide with "col_123", so it should loop and draw "col_456"
        col2 = manager.add_column(name="Col 2", type="text")
        
        assert col2.id == "col_456"
        assert len(manager.get_jats().columns) == 2

def test_prevent_row_id_collision():
    manager = JatsManager()
    
    # Mock to return the same ID twice, then a new one
    with patch('jats.manager.generate_row_id', side_effect=["000000000abc", "000000000abc", "000000000xyz"]):
        manager.add_row({})
        
        # This insertion would collide with "000000000abc", so it should loop and draw "000000000xyz"
        row2 = manager.add_row({})
        
        assert row2.id == "000000000xyz"
        assert len(manager.get_jats().rows) == 2

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
