import pytest
from jats.manager import JatsManager
from jats.tools import JatsAgentTooling

def test_dynamic_model_generation():
    manager = JatsManager()
    col1 = manager.add_column("Task", "text", constraints={"required": True})
    col2 = manager.add_column("Count", "number")
    
    tools = JatsAgentTooling(manager)
    model = tools.generate_row_model()
    
    schema = model.model_json_schema()
    props = schema["properties"]
    
    assert col1.id in props
    assert props[col1.id]["type"] == "string"
    
    assert col2.id in props
    assert props[col2.id]["anyOf"][0]["type"] == "number" # Optional wrapper
    
    # Check strict config
    assert model.model_config["extra"] == "forbid"

def test_format_openai():
    manager = JatsManager()
    col = manager.add_column("Url", "url")
    
    tools = JatsAgentTooling(manager)
    tool_def = tools.format_openai("add_link")
    
    assert tool_def["type"] == "function"
    assert tool_def["function"]["strict"] is True
    assert tool_def["function"]["name"] == "add_link"
    
    params = tool_def["function"]["parameters"]
    assert col.id in params["properties"]

def test_format_anthropic():
    manager = JatsManager()
    col = manager.add_column("IsDone", "boolean")
    
    tools = JatsAgentTooling(manager)
    tool_def = tools.format_anthropic("update_task")
    
    assert "input_schema" in tool_def
    assert col.id in tool_def["input_schema"]["properties"]
    # Boolean might be represented as boolean type in JSON schema
    assert tool_def["input_schema"]["properties"][col.id]["anyOf"][0]["type"] == "boolean"
