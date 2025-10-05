"""
CSV utility functions for consistent CSV export across the application.
"""

def escape_csv_value(value):
    """
    Escape a value for CSV output according to RFC 4180 standards.
    
    Args:
        value: The value to escape (any type, will be converted to string)
        
    Returns:
        str: Properly escaped CSV value
    """
    if value is None:
        return ""
    
    value_str = str(value)
    
    # Escape quotes by doubling them and wrap in quotes if contains comma, quote, or newline
    if '"' in value_str or ',' in value_str or '\n' in value_str or '\r' in value_str:
        escaped_str = value_str.replace('"', '""')
        return f'"{escaped_str}"'
    
    return value_str


def create_csv_response(headers, rows, filename):
    """
    Create a CSV string from headers and rows.
    
    Args:
        headers: List of header strings
        rows: List of lists containing row data
        filename: Suggested filename for the CSV
        
    Returns:
        str: Complete CSV content
    """
    csv_lines = []
    
    # Add headers
    csv_lines.append(','.join(escape_csv_value(header) for header in headers))
    
    # Add data rows
    for row in rows:
        csv_lines.append(','.join(escape_csv_value(cell) for cell in row))
    
    return '\n'.join(csv_lines)