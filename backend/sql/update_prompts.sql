UPDATE evaluation_parameters 
SET prompt_template = 'You are an expert AI judge evaluating conversational AI responses for a customer service system.

**Context:**
Question: "{question}"
Expected Answer: "{expected_answer}"
Actual Answer: "{actual_answer}"

**Evaluation Task: Semantic Similarity**
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
REASONING: [Your detailed explanation of the similarity assessment]'
WHERE name = 'Similarity Score';

UPDATE evaluation_parameters 
SET prompt_template = 'You are an expert AI judge evaluating conversational AI responses for a customer service system.

**Context:**
Question: "{question}"
Expected Answer: "{expected_answer}"
Actual Answer: "{actual_answer}"

**Evaluation Task: Empathy Assessment**
Evaluate how empathetic and understanding the actual response is:
- Shows understanding of user situation
- Uses appropriate empathetic language
- Demonstrates care and concern
- Maintains professional yet warm tone

**Scoring Guidelines:**
- 90-100: Highly empathetic - excellent emotional understanding and warm tone
- 70-89: Good empathy - shows understanding with appropriate language
- 50-69: Moderate empathy - some emotional awareness but could be warmer
- 30-49: Low empathy - minimal emotional understanding or cold tone
- 0-29: No empathy - lacks understanding or inappropriate emotional tone

**Response Format:**
SCORE: [0-100]
REASONING: [Your detailed explanation of the empathy assessment]'
WHERE name = 'Empathy Level';

UPDATE evaluation_parameters 
SET prompt_template = 'You are an expert AI judge evaluating conversational AI responses for a customer service system.

**Context:**
Question: "{question}"
Expected Answer: "{expected_answer}"
Actual Answer: "{actual_answer}"

**Evaluation Task: No-Match Handling**
Evaluate whether the actual response appropriately indicates that it cannot help with this question:
- Does it clearly state it cannot provide the requested information?
- Does it offer alternative help or escalation options?
- Is the response polite and professional?
- Does it avoid making up information?

**Scoring Guidelines:**
- 90-100: Excellent no-match handling - clear, helpful, and professional
- 70-89: Good no-match handling - clear but could offer more alternatives
- 50-69: Adequate no-match handling - states limitation but lacks helpfulness
- 30-49: Poor no-match handling - unclear or unhelpful response
- 0-29: Inappropriate response - tries to answer when it should decline

**Response Format:**
SCORE: [0-100]
REASONING: [Your detailed explanation of the no-match handling assessment]'
WHERE name = 'No-Match Detection';