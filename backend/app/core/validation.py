"""
Validation utilities for the application.
"""
from typing import Dict, List, Optional
from fastapi import HTTPException


def validate_session_parameters(session_parameters: Optional[Dict[str, str]], context: str = "request") -> Dict[str, str]:
    """
    Validate session parameters to ensure no duplicate keys and proper format.
    
    Args:
        session_parameters: Dictionary of session parameters to validate
        context: Context for error messages (e.g., "test run", "quick test")
        
    Returns:
        The validated session parameters dictionary
        
    Raises:
        HTTPException: If validation fails
    """
    if not session_parameters:
        return {}
    
    if not isinstance(session_parameters, dict):
        raise HTTPException(
            status_code=400,
            detail=f"Session parameters must be a dictionary object for {context}"
        )
    
    # Check for empty keys
    empty_keys = [key for key in session_parameters.keys() if not key or not key.strip()]
    if empty_keys:
        raise HTTPException(
            status_code=400,
            detail=f"Session parameters cannot have empty keys for {context}"
        )
    
    # Check for duplicate keys (this shouldn't happen with dict, but check for other issues)
    seen_keys = set()
    duplicate_keys = []
    
    for key in session_parameters.keys():
        key_lower = key.lower().strip()
        if key_lower in seen_keys:
            duplicate_keys.append(key)
        seen_keys.add(key_lower)
    
    if duplicate_keys:
        raise HTTPException(
            status_code=400,
            detail=f"Duplicate session parameter keys detected (case-insensitive) for {context}: {', '.join(duplicate_keys)}"
        )
    
    # Check for None values
    none_keys = [key for key, value in session_parameters.items() if value is None]
    if none_keys:
        raise HTTPException(
            status_code=400,
            detail=f"Session parameters cannot have null values for {context}: {', '.join(none_keys)}"
        )
    
    # Ensure all values are strings
    non_string_keys = [key for key, value in session_parameters.items() if not isinstance(value, str)]
    if non_string_keys:
        raise HTTPException(
            status_code=400,
            detail=f"All session parameter values must be strings for {context}: {', '.join(non_string_keys)}"
        )
    
    # Return cleaned parameters (strip whitespace from keys and values)
    cleaned_parameters = {}
    for key, value in session_parameters.items():
        cleaned_key = key.strip()
        cleaned_value = value.strip() if isinstance(value, str) else str(value)
        
        if not cleaned_key:
            raise HTTPException(
                status_code=400,
                detail=f"Session parameter keys cannot be empty or whitespace-only for {context}"
            )
            
        cleaned_parameters[cleaned_key] = cleaned_value
    
    return cleaned_parameters


def validate_unique_keys_in_list(
    items: List[Dict[str, str]], 
    key_field: str = "key", 
    context: str = "items"
) -> None:
    """
    Validate that a list of dictionaries has unique values for a specific key field.
    
    Args:
        items: List of dictionaries to validate
        key_field: The field name to check for uniqueness
        context: Context for error messages
        
    Raises:
        HTTPException: If duplicate keys are found
    """
    if not items:
        return
    
    seen_keys = set()
    duplicate_keys = []
    
    for item in items:
        if not isinstance(item, dict):
            continue
            
        key_value = item.get(key_field, "").strip().lower()
        if key_value in seen_keys:
            duplicate_keys.append(item.get(key_field, ""))
        seen_keys.add(key_value)
    
    if duplicate_keys:
        raise HTTPException(
            status_code=400,
            detail=f"Duplicate {key_field} values detected (case-insensitive) in {context}: {', '.join(duplicate_keys)}"
        )