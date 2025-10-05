"""
HTML detection and cleaning utilities for CSV import processing.
"""
import re
from typing import Dict, List, Tuple, Optional
from bs4 import BeautifulSoup


def detect_html_in_text(text: str) -> bool:
    """
    Detect if text contains HTML tags.
    
    Args:
        text: The text to analyze
        
    Returns:
        True if HTML tags are detected, False otherwise
    """
    if not text or not isinstance(text, str):
        return False
    
    # Look for HTML-like tags
    html_pattern = r'<[^>]+>'
    return bool(re.search(html_pattern, text))


def count_html_tags(text: str) -> int:
    """
    Count the number of HTML tags in text.
    
    Args:
        text: The text to analyze
        
    Returns:
        Number of HTML tags found
    """
    if not text or not isinstance(text, str):
        return 0
    
    html_pattern = r'<[^>]+>'
    return len(re.findall(html_pattern, text))


def extract_html_tags(text: str) -> List[str]:
    """
    Extract all HTML tags found in text.
    
    Args:
        text: The text to analyze
        
    Returns:
        List of unique HTML tags found (e.g., ['<p>', '<br>', '<strong>'])
    """
    if not text or not isinstance(text, str):
        return []
    
    html_pattern = r'<[^>]+>'
    tags = re.findall(html_pattern, text)
    return list(set(tags))


def strip_html_tags(text: str, preserve_line_breaks: bool = True) -> str:
    """
    Remove HTML tags from text while preserving the text content.
    
    Args:
        text: The text to clean
        preserve_line_breaks: If True, convert <br> tags to newlines
        
    Returns:
        Text with HTML tags removed
    """
    if not text or not isinstance(text, str):
        return text or ""
    
    try:
        # Use BeautifulSoup for safe HTML parsing
        soup = BeautifulSoup(text, 'html.parser')
        
        # Handle line breaks if requested
        if preserve_line_breaks:
            # Replace <br> tags with newlines before stripping
            for br in soup.find_all(['br', 'BR']):
                br.replace_with('\n')
            
            # Replace block elements with newlines
            for block in soup.find_all(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
                if block.string:
                    block.insert_after('\n')
        
        # Get text content without HTML tags
        clean_text = soup.get_text()
        
        # Clean up extra whitespace
        clean_text = re.sub(r'\n\s*\n', '\n', clean_text)  # Remove multiple blank lines
        clean_text = re.sub(r'[ \t]+', ' ', clean_text)    # Normalize spaces
        clean_text = clean_text.strip()
        
        return clean_text
        
    except Exception as e:
        # Fallback to regex-based cleaning if BeautifulSoup fails
        print(f"Warning: BeautifulSoup failed, using regex fallback: {e}")
        return _regex_strip_html(text, preserve_line_breaks)


def _regex_strip_html(text: str, preserve_line_breaks: bool = True) -> str:
    """
    Fallback regex-based HTML tag removal.
    
    Args:
        text: The text to clean
        preserve_line_breaks: If True, convert <br> tags to newlines
        
    Returns:
        Text with HTML tags removed using regex
    """
    if preserve_line_breaks:
        # Convert <br> tags to newlines first
        text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'</(p|div|h[1-6])>', '\n', text, flags=re.IGNORECASE)
    
    # Remove all HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    
    # Clean up whitespace
    text = re.sub(r'\n\s*\n', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = text.strip()
    
    return text


def analyze_html_in_csv_column(column_data: List[str], sample_size: int = 50) -> Dict:
    """
    Analyze HTML content in a CSV column and provide statistics.
    
    Args:
        column_data: List of values from a CSV column
        sample_size: Maximum number of rows to analyze for performance
        
    Returns:
        Dictionary with HTML analysis results
    """
    if not column_data:
        return {
            "has_html": False,
            "total_rows": 0,
            "rows_with_html": 0,
            "html_percentage": 0.0,
            "common_tags": [],
            "sample_html_found": [],
            "recommended_action": "none"
        }
    
    total_rows = len(column_data)
    sample_data = column_data[:sample_size] if len(column_data) > sample_size else column_data
    
    rows_with_html = 0
    all_tags = []
    sample_html_found = []
    
    for i, cell_value in enumerate(sample_data):
        if detect_html_in_text(str(cell_value)):
            rows_with_html += 1
            tags = extract_html_tags(str(cell_value))
            all_tags.extend(tags)
            
            # Collect some examples for preview
            if len(sample_html_found) < 3:
                sample_html_found.append({
                    "row_index": i + 1,
                    "original": str(cell_value)[:200] + ("..." if len(str(cell_value)) > 200 else ""),
                    "cleaned": strip_html_tags(str(cell_value))[:200] + ("..." if len(strip_html_tags(str(cell_value))) > 200 else ""),
                    "tags_found": tags
                })
    
    # Calculate statistics
    html_percentage = (rows_with_html / len(sample_data)) * 100
    
    # Count tag frequency
    tag_counts = {}
    for tag in all_tags:
        tag_counts[tag] = tag_counts.get(tag, 0) + 1
    
    # Get most common tags
    common_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # Determine recommendation
    if html_percentage == 0:
        recommended_action = "none"
    elif html_percentage < 10:
        recommended_action = "ask_user"  # Some HTML found, let user decide
    else:
        recommended_action = "recommend_strip"  # Significant HTML found, recommend stripping
    
    return {
        "has_html": rows_with_html > 0,
        "total_rows": total_rows,
        "sample_size": len(sample_data),
        "rows_with_html": rows_with_html,
        "html_percentage": round(html_percentage, 1),
        "common_tags": [{"tag": tag, "count": count} for tag, count in common_tags],
        "sample_html_found": sample_html_found,
        "recommended_action": recommended_action
    }


def process_csv_column_with_html_option(column_data: List[str], strip_html: bool = False) -> List[str]:
    """
    Process a CSV column, optionally stripping HTML tags.
    
    Args:
        column_data: List of values from a CSV column
        strip_html: Whether to strip HTML tags
        
    Returns:
        Processed column data
    """
    if not strip_html:
        return column_data
    
    processed_data = []
    for cell_value in column_data:
        if cell_value is None:
            processed_data.append("")
        else:
            processed_data.append(strip_html_tags(str(cell_value)))
    
    return processed_data