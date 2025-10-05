"""
Simple Prompt Template System for LLM Evaluation Parameters

This module provides a simple way to build evaluation prompts with just
two customizable sections: evaluation task and scoring guidelines.
The context, response format, and instructions are standardized.
"""

from typing import Dict, Any, List, Optional


def build_evaluation_prompt(evaluation_task: str, scoring_guidelines: str) -> str:
    """
    Build a complete evaluation prompt from task and guidelines.
    
    Args:
        evaluation_task: Description of what to evaluate (e.g., "Semantic Similarity")
        scoring_guidelines: Detailed scoring criteria with ranges (e.g., "90-100: Excellent...")
    
    Returns:
        Complete prompt template ready for use with variables {question}, {expected_answer}, {actual_answer}
    """
    
    return f"""You are an expert AI judge evaluating conversational AI responses for a customer service system.

**Context:**
Question: "{{question}}"
Expected Answer: "{{expected_answer}}"
Actual Answer: "{{actual_answer}}"

**Evaluation Task: {evaluation_task}**
{evaluation_task}

**Scoring Guidelines:**
{scoring_guidelines}

**Response Format:**
SCORE: [0-100]
REASONING: [Maximum 15 words explaining the primary gap or strength]

**CRITICAL Instructions:**
- Score must be between 0-100
- Reasoning MUST be under 15 words total
- NO bullet points, NO detailed explanations
- ONE simple sentence only
- Focus on the main issue affecting the score"""


def validate_prompt_components(evaluation_task: str, scoring_guidelines: str) -> Dict[str, Any]:
    """
    Validate that prompt components are properly formatted.
    
    Returns:
        Dict with 'valid' boolean and 'errors' list
    """
    errors = []
    
    # Check evaluation task
    if not evaluation_task or not evaluation_task.strip():
        errors.append("Evaluation task is required")
    elif len(evaluation_task.strip()) < 10:
        errors.append("Evaluation task must be at least 10 characters")
    
    # Check scoring guidelines
    if not scoring_guidelines or not scoring_guidelines.strip():
        errors.append("Scoring guidelines are required")
    elif len(scoring_guidelines.strip()) < 20:
        errors.append("Scoring guidelines must be at least 20 characters")
    
    # Check for score ranges in guidelines
    guidelines_text = scoring_guidelines.lower()
    has_score_ranges = any(pattern in guidelines_text for pattern in [
        '0-', '10-', '20-', '30-', '40-', '50-', '60-', '70-', '80-', '90-', '100'
    ])
    
    if not has_score_ranges:
        errors.append("Scoring guidelines should include score ranges (e.g., '90-100: Excellent')")
    
    return {
        'valid': len(errors) == 0,
        'errors': errors
    }


# Legacy function for compatibility with existing code
def validate_prompt_template(prompt_template: str) -> Dict[str, Any]:
    """
    Legacy validation function for backwards compatibility.
    Now just checks if prompt is not empty.
    """
    if not prompt_template or not prompt_template.strip():
        return {
            'valid': False,
            'errors': ['Prompt template cannot be empty']
        }
    
    return {
        'valid': True,
        'errors': []
    }

# Default prompt components for common evaluation types
DEFAULT_PROMPTS = {
    "Similarity Score": {
        "evaluation_task": "Rate semantic similarity between answers. Give score and brief reason (under 15 words).",
        "scoring_guidelines": "- 90-100: Excellent match - covers all key points with appropriate tone\n- 70-89: Good match - covers most key points with minor gaps\n- 50-69: Partial match - covers some key points but missing important information\n- 30-49: Poor match - misses most key points or provides incorrect information\n- 0-29: No match - completely irrelevant or contradictory response"
    },
    
    "Empathy Level": {
        "evaluation_task": "Rate empathy level in response. Give score and brief reason (under 15 words).",
        "scoring_guidelines": "- 90-100: Highly empathetic - excellent emotional understanding and warm tone\n- 70-89: Good empathy - shows understanding with appropriate language\n- 50-69: Moderate empathy - some emotional awareness but could be warmer\n- 30-49: Low empathy - minimal emotional understanding or cold tone\n- 0-29: No empathy - lacks understanding or inappropriate emotional tone"
    },
    
    "No-Match Detection": {
        "evaluation_task": "Rate how appropriately response declines to help. Give score and brief reason (under 15 words).",
        "scoring_guidelines": "- 90-100: Excellent no-match handling - clear, helpful, and professional\n- 70-89: Good no-match handling - clear but could offer more alternatives\n- 50-69: Adequate no-match handling - states limitation but lacks helpfulness\n- 30-49: Poor no-match handling - unclear or unhelpful response\n- 0-29: Inappropriate response - tries to answer when it should decline"
    }
}


def get_default_prompt_components(parameter_name: str) -> Dict[str, str]:
    """
    Get default evaluation task and scoring guidelines for a parameter.
    
    Args:
        parameter_name: Name of the evaluation parameter
        
    Returns:
        Dict with 'evaluation_task' and 'scoring_guidelines' keys
    """
    return DEFAULT_PROMPTS.get(parameter_name, {
        "evaluation_task": "Evaluate the response based on your specific criteria",
        "scoring_guidelines": "- 90-100: Excellent\n- 70-89: Good\n- 50-69: Average\n- 30-49: Poor\n- 0-29: Very Poor"
    })


def validate_prompt_template(template: str) -> Dict[str, Any]:
    """
    Validate a prompt template for basic structure.
    
    Args:
        template: The prompt template to validate
        
    Returns:
        Dict with 'valid' boolean and 'errors' list
    """
    errors = []
    
    if not template or not template.strip():
        errors.append("Template cannot be empty")
        return {"valid": False, "errors": errors}
    
    # Check for required placeholders
    required_placeholders = ["{question}", "{expected_answer}", "{actual_answer}"]
    for placeholder in required_placeholders:
        if placeholder not in template:
            errors.append(f"Missing required placeholder: {placeholder}")
    
    # Basic length check
    if len(template) < 50:
        errors.append("Template seems too short to be effective")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors
    }


def get_default_templates() -> Dict[str, str]:
    """
    Get default templates for backward compatibility.
    
    Returns:
        Dict mapping parameter names to full prompt templates
    """
    templates = {}
    for param_name, components in DEFAULT_PROMPTS.items():
        templates[param_name] = build_evaluation_prompt(
            components["evaluation_task"],
            components["scoring_guidelines"]
        )
    return templates