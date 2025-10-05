from app.core.csv_utils import escape_csv_value, create_csv_response

def test_escape_csv_value_simple():
    """Test escaping simple values."""
    assert escape_csv_value("hello") == "hello"
    assert escape_csv_value(123) == "123"
    assert escape_csv_value(None) == ""

def test_escape_csv_value_with_commas():
    """Test escaping values containing commas."""
    assert escape_csv_value("hello,world") == '"hello,world"'
    assert escape_csv_value("a,b,c") == '"a,b,c"'

def test_escape_csv_value_with_quotes():
    """Test escaping values containing quotes."""
    assert escape_csv_value('He said "hello"') == '"He said ""hello"""'
    assert escape_csv_value('"quoted"') == '"""quoted"""'

def test_escape_csv_value_with_newlines():
    """Test escaping values containing newlines."""
    assert escape_csv_value("line1\nline2") == '"line1\nline2"'
    assert escape_csv_value("line1\r\nline2") == '"line1\r\nline2"'

def test_escape_csv_value_complex():
    """Test escaping complex values with multiple special characters."""
    complex_value = 'Value with "quotes", commas, and\nnewlines'
    expected = '"Value with ""quotes"", commas, and\nnewlines"'
    assert escape_csv_value(complex_value) == expected

def test_create_csv_response():
    """Test creating CSV response from headers and rows."""
    headers = ["Name", "Age", "City"]
    rows = [
        ["John Doe", 30, "New York"],
        ["Jane Smith", 25, "Los Angeles"],
        ['Bob "The Builder"', 35, "Chicago, IL"]
    ]
    filename = "test.csv"

    csv_content = create_csv_response(headers, rows, filename)

    expected_lines = [
        "Name,Age,City",
        "John Doe,30,New York",
        "Jane Smith,25,Los Angeles",
        '"Bob ""The Builder""",35,"Chicago, IL"'
    ]
    expected = "\n".join(expected_lines)

    assert csv_content == expected

def test_create_csv_response_empty():
    """Test creating CSV response with empty data."""
    headers = ["Col1", "Col2"]
    rows = []
    filename = "empty.csv"

    csv_content = create_csv_response(headers, rows, filename)
    assert csv_content == "Col1,Col2"

def test_create_csv_response_single_row():
    """Test creating CSV response with single row."""
    headers = ["ID", "Value"]
    rows = [[1, "test"]]
    filename = "single.csv"

    csv_content = create_csv_response(headers, rows, filename)
    assert csv_content == "ID,Value\n1,test"