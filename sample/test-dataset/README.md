# Test Data

This folder contains CSV test datasets for the [Customer Service Agent](../customer-service-agent/) sample Dialogflow CX agent.

## 📁 Files

### Test Datasets
- **`general_questions.csv`** - 25 general business questions covering hours, support contact, policies, shipping, and account management
- **`technical_questions.csv`** - 25 technical support questions covering password reset, security, browsers, API, authentication, and system requirements

These datasets are designed to test the customer service agent's ability to handle common inquiries across different categories.

## 🔧 Usage

These CSV files can be imported and tested in the Dialogflow Test Suite application:

1. **Import Dataset**: Navigate to the Datasets page and upload one of the CSV files
2. **Create Test Run**: Select the imported dataset and configure your test parameters
3. **Select Agent**: Choose the customer service agent from your Dialogflow CX project
4. **Run Evaluation**: Execute the test and view results with LLM-powered evaluation scores

The agent is designed to provide high-accuracy responses for the most common questions in each dataset.

## 📋 CSV Format

Both test datasets use a simple two-column format:

```csv
question,expected_answer
"How do I reset my password?","You can reset your password by clicking on the 'Forgot Password' link on the login page."
"What are your business hours?","Our business hours are Monday to Friday, 9 AM to 5 PM."
```

### Columns
- **question** (required) - The test question to send to the Dialogflow agent
- **expected_answer** (required) - The expected response for LLM evaluation comparison

## 🎯 Expected Results

When testing with the customer service agent:
- **High Accuracy Questions**: The agent has specific intents for common questions like password reset, security measures, two-factor authentication, business hours, contact support, return policy, shipping info, browser support, API information, and cookie policy
- **Generic Responses**: Other questions will receive a generic fallback response with lower evaluation scores

This demonstrates realistic agent performance where specific training yields high accuracy for targeted questions.

## 🔗 Related

- [Customer Service Agent](../customer-service-agent/) - The Dialogflow CX agent designed for these test datasets
- [Quick Testing Guide](../../docs/guides/quick-testing.md) - How to use the test suite application