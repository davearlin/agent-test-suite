# Quick Test Feature - Dialogflow Agent Testing

## Overview

The Quick Test feature allows you to instantly test prompts against your Dialogflow CX agents directly from the web interface. This feature provides a convenient way to validate agent responses, test conversation flows, and debug agent behavior without needing to use the Dialogflow Console.

**Latest Enhancement (Oct 2024)**: Complete Dialogflow CX Playbooks support alongside traditional flows, plus multi-regional architecture support for testing agents across all Google Cloud regions.

## Features

### 🚀 **Instant Testing**
- Send text prompts directly to your Dialogflow CX agents
- Get real-time responses with detailed metadata
- View response time, intent detection, confidence scores, and parameters
- **Multi-Regional Support**: Automatically detects and connects to agents in any Google Cloud region
- **✅ Flow and Playbook Support**: Test both traditional conversation flows and new LLM-powered playbooks

### 🌍 **Multi-Regional Architecture**
- **Automatic Region Discovery**: Finds agents across global, us-central1, us-east1, us-west1, europe-west1, asia-northeast1
- **Dynamic Client Configuration**: Creates region-specific clients for optimal performance
- **Global Agent Support**: Handles agents in the "global" region with proper endpoint configuration
- **Location-Aware Testing**: Uses correct regional sessions client for each agent's location

### 🎯 **Unified Resource Selection**
- **Traditional Flows**: Select specific flows and pages within your agent (across all regions)
- **✅ Dialogflow CX Playbooks**: Select playbooks with LLM model configuration (v3beta1 API)
- **Conditional UI**: Dynamic interface that shows relevant options based on selection
- **Smart Defaults**: Automatically defaults to "Default Start Flow" for traditional testing
- **Model Selection**: Choose from available Gemini models when using playbooks

### 📊 **Detailed Response Information**
- **Agent Response**: The actual text response from the agent (flows and playbooks)
- **Intent Detection**: Detected intent name and confidence score (flows)
- **Playbook Responses**: LLM-generated responses with model information (playbooks)
- **Parameters**: Extracted entities and their values
- **Response Time**: Execution time in milliseconds
- **Session Management**: Track conversation sessions with regional session handling

### 🔧 **Configuration Options**
- **Project Selection**: Choose from accessible Google Cloud projects
- **Agent Selection**: Choose from available Dialogflow CX agents across all regions
- **Resource Type Selection**: Choose between traditional flows or new playbooks
- **Flow Configuration**: Optional flow and page targeting (for traditional flows)
- **Playbook Configuration**: Playbook selection with LLM model choice (for playbooks)
- **Session ID**: Optional session management (auto-generated if not provided)

### 🤖 **Playbook Testing (New)**
The Quick Test feature now supports Dialogflow CX Playbooks alongside traditional flows:

**What are Playbooks?**
- LLM-powered conversational AI using Dialogflow CX v3beta1 API
- Generative responses powered by Google's Gemini models
- More flexible, context-aware conversations compared to traditional flows

**Playbook Configuration:**
- **Playbook Selection**: Choose from available playbooks in your agent
- **Model Selection**: Select Gemini model (e.g., `gemini-1.5-flash`, `gemini-1.5-pro`)
- **Query Parameters**: Uses `current_playbook` parameter for proper routing
- **Regional Support**: Playbooks work across all Google Cloud regions

**Playbook vs Flow Testing:**
- **Traditional Flows**: Structured conversation paths with intent matching
- **Playbooks**: AI-generated responses based on context and training
- **Unified Interface**: Single Quick Test page handles both types seamlessly
- **Conditional UI**: Interface adapts based on selected resource type

## Getting Started

### 1. **Access the Quick Test Page**
Navigate to the Quick Test page from the main navigation menu:
- Click on "Quick Test" in the sidebar navigation
- Or visit directly: `http://localhost:3000/quick-test`

### 2. **Configure Your Test**
1. **Select Project**: Choose your Google Cloud project from the dropdown
   - Shows all projects accessible with your OAuth credentials
2. **Select Agent**: Choose your Dialogflow agent from the dropdown
   - Automatically discovers agents across all Google Cloud regions
   - Displays agents from selected project only
3. **Choose Resource Type**: Select either a Flow or Playbook
   
   **For Traditional Flow Testing:**
   - **Select Flow** (Optional): Choose a specific flow or leave blank for default
   - **Select Page** (Optional): Choose a starting page or leave blank for default
   
   **For Playbook Testing:**
   - **Select Playbook**: Choose from available playbooks in your agent  
   - **Select Model**: Choose LLM model (e.g., `gemini-1.5-flash`, `gemini-1.5-pro`)
   
4. **Set Session ID** (Optional): Provide a session ID or let the system generate one

### 3. **Send Test Prompts**
1. Enter your prompt in the text area
2. Click "Send Test" to execute (uses regional SessionsClient)
3. View the detailed response information
4. **Fixed**: QueryParameters API compatibility resolved for cross-regional testing

## API Endpoints

The Quick Test feature uses the following API endpoints with multi-regional support:

### **GET** `/api/v1/dialogflow/projects`
Lists all Google Cloud projects accessible to the authenticated user.

### **GET** `/api/v1/dialogflow/agents?project_id={project_id}`
Lists all available Dialogflow CX agents across all regions for the specified project.
- **Regional Discovery**: Searches global, us-central1, us-east1, us-west1, europe-west1, asia-northeast1
- **Location Awareness**: Returns agent location information for regional client routing

### **GET** `/api/v1/dialogflow/agents/{agent_id}/flows`
Lists all flows for a specific agent using the correct regional FlowsClient.
- **Auto-Regional**: Automatically determines agent's location and uses appropriate regional client

### **GET** `/api/v1/dialogflow/agents/{agent_id}/flows/{flow_id}/pages`
Lists all pages for a specific flow using the correct regional PagesClient.
- **Auto-Regional**: Automatically determines flow's location and uses appropriate regional client

### **POST** `/api/v1/dialogflow/quick-test`
Executes a quick test against a Dialogflow agent using the correct regional SessionsClient.
- **Regional Routing**: Automatically finds agent's location and creates appropriate regional sessions client
- **QueryParameters Fix**: Resolved API compatibility issues for cross-regional testing

**Request Body:**
```json
{
  "prompt": "What is my account balance?",
  "agent_id": "f4f0de0a-c228-4622-b218-c84493ab7b4a",
  "flow_id": "default-start-flow",
  "page_id": "start-page",
  "session_id": "test-session-123"
}
```

**Response:**
```json
{
  "prompt": "What is my account balance?",
  "response": "I can help you check your account balance...",
  "agent_id": "f4f0de0a-c228-4622-b218-c84493ab7b4a",
  "flow_id": "default-start-flow",
  "page_id": "start-page",
  "session_id": "test-session-123",
  "response_time_ms": 245,
  "intent": "account.balance",
  "confidence": 0.95,
  "parameters": {
    "account_type": "checking"
  },
  "response_messages": [
    "I can help you check your account balance..."
  ],
  "is_mock": false
}
```

## Technical Implementation

### Multi-Regional Backend Architecture
- **Regional Client Factory**: Dynamic creation of location-specific Dialogflow clients
- **Agent Location Discovery**: `_find_agent_full_name()` method searches across all regions
- **Regional Endpoint Configuration**: Automatic {location}-dialogflow.googleapis.com handling
- **Global Region Support**: Special handling for agents in the "global" region

### Backend Changes
- **Enhanced API endpoints** in `backend/app/api/dialogflow.py` with multi-project support
- **Regional quick test service** in `backend/app/services/dialogflow_service.py`
- **Multi-regional client architecture** with dynamic location discovery
- **QueryParameters fix** for API compatibility across regions
- **Request/Response schemas** in `backend/app/models/schemas.py`

### Frontend Changes
- **Enhanced QuickTestPage component** in `frontend/src/pages/QuickTestPage.tsx`
- **Project selection dropdown** with OAuth-based project listing
- **Regional-aware API service** with multi-project support in `frontend/src/services/api.ts`
- **User preference persistence** for project, agent, flow, and page selections
- **Searchable dropdowns** using Material-UI Autocomplete components
- **Race condition protection** for preference loading and state management

### Key Regional Features
- **Automatic Region Discovery**: Searches across global, us-central1, us-east1, us-west1, europe-west1, asia-northeast1
- **Dynamic Client Routing**: Creates region-specific clients for optimal performance and correct API endpoints
- **Cross-Regional Flow Support**: Flows and pages work seamlessly regardless of agent location
- **Regional Session Management**: Uses correct regional SessionsClient for each agent's location
- **Error Handling**: Graceful fallbacks when regions are inaccessible or agents are not found
- **Location Context Preservation**: Maintains location information throughout the workflow

## Default Agent Configuration

The feature is pre-configured to work with your agent:
- **Agent ID**: `f4f0de0a-c228-4622-b218-c84493ab7b4a`
- **Project**: `your-gcp-project-id`
- **Location**: `us-central1`
- **Agent Name**: "Launch_Dave_v1"

## Usage Examples

### Basic Test
1. Select "Launch_Dave_v1" agent (pre-selected)
2. Enter prompt: "Hello, I need help with my payroll"
3. Click "Send Test"
4. Review the response and metadata

### Flow-Specific Test
1. Select your agent
2. Choose "Payroll Flow" from the flows dropdown
3. Select "Payroll Start" page
4. Enter prompt: "Show me my pay stub"
5. Send test and analyze results

### Session Continuation
1. Use the same session ID across multiple tests
2. Build conversation context progressively
3. Test multi-turn conversation flows

## Benefits

### 🔍 **Quick Debugging**
- Instantly test agent responses without leaving the platform
- Identify intent detection issues
- Validate parameter extraction

### 📈 **Development Efficiency**
- Rapid iteration during agent development
- Easy testing of different conversation paths
- Immediate feedback on agent changes

### 🎯 **Targeted Testing**
- Test specific flows and pages
- Validate conversation entry points
- Debug flow transitions

### 📊 **Detailed Insights**
- Complete response metadata
- Performance metrics (response time)
- Intent confidence scores
- Parameter extraction details

## Future Enhancements

Potential future improvements to the Quick Test feature:
- **Conversation history**: Track multi-turn conversations
- **Bulk testing**: Test multiple prompts at once
- **Response comparison**: Compare responses across agent versions
- **Export functionality**: Export test results for analysis
- **Voice input**: Test voice prompts if voice agents are configured
- **Response evaluation**: Integrate with LLM evaluation for response quality

## Troubleshooting

### Common Issues

1. **"Failed to load agents" error**
   - Check Google Cloud authentication and OAuth token validity
   - Verify user has proper IAM permissions for Dialogflow CX
   - Ensure Dialogflow CX API is enabled for the selected project
   - Check if agents exist in any of the supported regions

2. **"Agent not found in any location" error**
   - Verify the agent exists and is accessible
   - Check if the agent is in a region not currently supported
   - Ensure proper IAM permissions for the agent's region
   - Try refreshing the agent list after checking permissions

3. **"Mock response" displayed**
   - This indicates Dialogflow credentials are not properly configured
   - Verify OAuth authentication is working
   - Check if the user has proper Google Cloud access
   - Ensure the project has Dialogflow CX API enabled

4. **No flows or pages loading**
   - Ensure the agent has flows configured in the Dialogflow Console
   - Check agent permissions for the specific region
   - Verify the agent ID is correct and the agent is accessible
   - Check if the regional client is properly configured for the agent's location

5. **"QueryParameters error" messages**
   - This has been resolved in the latest version (Sept 12, 2025)
   - Ensure you're using the updated backend with the QueryParameters fix
   - If still occurring, check the agent's Dialogflow CX API version compatibility

6. **Slow response times**
   - Normal for first request (cold start) especially for regional clients
   - Subsequent requests should be faster with regional client caching
   - Check network connectivity to the specific Google Cloud region
   - Consider agent region proximity for optimal performance

7. **Cross-regional functionality issues**
   - Ensure all regional endpoints are accessible from your network
   - Check if your organization has any firewall restrictions for Google Cloud regions
   - Verify the agent's region supports the specific Dialogflow CX features being used
   - Try testing with agents in different regions to isolate region-specific issues

### Regional Architecture Debug

**Supported Regions**: global, us-central1, us-east1, us-west1, europe-west1, asia-northeast1

**Regional Client Endpoints**:
- **Global**: Default Dialogflow endpoint
- **Regional**: {location}-dialogflow.googleapis.com

**Troubleshooting Regional Issues**:
1. Check backend logs for regional client creation errors
2. Verify the agent's location is correctly detected
3. Ensure the regional endpoint is accessible
4. Test with agents in different regions to isolate issues

### Debug Mode
When Dialogflow credentials are not available, the system operates in mock mode:
- Returns simulated responses for testing UI functionality
- Allows development and testing without GCP setup
- Clearly indicates mock responses in the UI
- **Regional Mock Support**: Simulates responses for agents in different regions

This enhanced Quick Test feature with multi-regional architecture significantly improves the development and testing workflow for Dialogflow agents across all Google Cloud regions, providing immediate feedback and detailed insights into agent behavior regardless of their geographic location.