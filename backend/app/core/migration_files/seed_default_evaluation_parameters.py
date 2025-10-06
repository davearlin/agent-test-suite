"""
Migration to seed default evaluation parameters
These are the system default parameters that should be available for all users
"""
from sqlalchemy import text
from app.core.database import engine


def upgrade():
    """Seed default evaluation parameters if they don't exist"""
    with engine.connect() as connection:
        # Check if we already have system default parameters
        result = connection.execute(text("""
            SELECT COUNT(*) FROM evaluation_parameters WHERE is_system_default = true;
        """))
        
        count = result.scalar()
        
        if count > 0:
            print(f"✅ System default evaluation parameters already exist ({count} found), skipping seed...")
            return
        
        print("🌱 Seeding default evaluation parameters...")
        
        # Get a system user ID (first admin user) for created_by_id
        # If no users exist yet, this will be NULL which is allowed by the schema
        user_result = connection.execute(text("""
            SELECT id FROM users WHERE role = 'admin' LIMIT 1;
        """))
        user_row = user_result.fetchone()
        created_by_id = user_row[0] if user_row else None
        
        # Define the three default evaluation parameters
        default_parameters = [
            {
                'name': 'Similarity Score',
                'description': 'Measures semantic similarity between expected and actual responses',
                'prompt_template': '''You are an expert AI judge evaluating conversational AI responses for a customer service system.

**Context:**
Question: "{question}"
Expected Answer: "{expected_answer}"
Actual Answer: "{actual_answer}"

**Evaluation Task:**
Evaluate how well the actual answer matches the expected answer in terms of:
- Semantic meaning and content accuracy
- Completeness of information
- Helpfulness to the user
- Appropriateness of tone

**Scoring Guidelines:**
- 90-100: Excellent match - covers all key points with appropriate tone
- 70-89: Good match - covers most key points with minor gaps
- 50-69: Partial match - covers some key points but missing important information
- 30-49: Poor match - misses most key points or provides incorrect information
- 0-29: No match - completely irrelevant or contradictory response

**Response Format:**
SCORE: [0-100]
REASONING: [Your detailed explanation of the assessment]

**Important Instructions:**
- Score must be between 0-100
- Provide clear reasoning for your score
- Consider the context and user's needs
- Be consistent and objective in your evaluation'''
            },
            {
                'name': 'Empathy Level',
                'description': 'Evaluates empathetic tone and understanding in customer service responses',
                'prompt_template': '''You are an expert AI judge evaluating conversational AI responses for a customer service system.

**Context:**
Question: "{question}"
Expected Answer: "{expected_answer}"
Actual Answer: "{actual_answer}"

**Evaluation Task:**
Evaluate how well the actual answer demonstrates empathy and emotional understanding:
- Recognition of customer emotions or concerns
- Appropriate emotional tone and language
- Supportive and understanding approach
- Validation of customer feelings

**Scoring Guidelines:**
- 90-100: Excellent empathy - fully acknowledges emotions with very supportive language
- 70-89: Good empathy - shows understanding with mostly supportive tone
- 50-69: Moderate empathy - some emotional awareness but could be more supportive
- 30-49: Limited empathy - minimal emotional understanding or inappropriate tone
- 0-29: No empathy - ignores emotions or responds inappropriately

**Response Format:**
SCORE: [0-100]
REASONING: [Your detailed explanation of the assessment]

**Important Instructions:**
- Score must be between 0-100
- Provide clear reasoning for your score
- Consider the context and user's needs
- Be consistent and objective in your evaluation'''
            },
            {
                'name': 'No-Match Detection',
                'description': 'Validates appropriate handling of requests the agent cannot fulfill',
                'prompt_template': '''You are an expert AI judge evaluating conversational AI responses for a customer service system.

**Context:**
Question: "{question}"
Expected Answer: "{expected_answer}"
Actual Answer: "{actual_answer}"

**Evaluation Task:**
Evaluate how well the actual answer handles questions that don't have direct matches:
- Acknowledges the limitation appropriately
- Provides helpful alternative suggestions
- Maintains professional and helpful tone
- Offers appropriate next steps or escalation

**Scoring Guidelines:**
- 90-100: Excellent handling - clearly acknowledges limitation with very helpful alternatives
- 70-89: Good handling - acknowledges limitation with helpful suggestions
- 50-69: Adequate handling - basic acknowledgment with some guidance
- 30-49: Poor handling - unclear response or unhelpful suggestions
- 0-29: Very poor handling - confusing, irrelevant, or no acknowledgment

**Response Format:**
SCORE: [0-100]
REASONING: [Your detailed explanation of the assessment]

**Important Instructions:**
- Score must be between 0-100
- Provide clear reasoning for your score
- Consider the context and user's needs
- Be consistent and objective in your evaluation'''
            }
        ]
        
        # Insert the default parameters
        for param in default_parameters:
            connection.execute(text("""
                INSERT INTO evaluation_parameters 
                (name, description, prompt_template, is_system_default, is_active, created_by_id)
                VALUES (:name, :description, :prompt_template, true, true, :created_by_id)
            """), {
                'name': param['name'],
                'description': param['description'],
                'prompt_template': param['prompt_template'],
                'created_by_id': created_by_id
            })
        
        connection.commit()
        print(f"✅ Successfully seeded {len(default_parameters)} default evaluation parameters")


if __name__ == "__main__":
    upgrade()
