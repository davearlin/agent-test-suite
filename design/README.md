# Design Documentation Index - Dialogflow Test Suite

This folder contains comprehensive Mermaid diagrams documenting the architecture, flows, and design patterns of the Dialogflow Test Suite application.

## 📋 **Documentation Overview**

### **1. System Architecture** (`system-architecture.md`)
- **High-Level System Architecture**: Complete system overview showing all layers
- **Technology Stack**: Detailed technology dependencies and relationships  
- **Container Architecture**: Docker containerization and service interactions

### **2. Application Flows** (`application-flows.md`)
- **User Authentication Flow**: Login, token management, and session handling
- **Dataset Management Flow**: Creating, editing, and managing test datasets
- **Question Management Flow**: Adding, editing, and bulk importing questions
- **Test Execution Flow**: Running tests against Dialogflow agents with AI evaluation

### **3. Data Model and API** (`data-model-api.md`)
- **Data Model Relationships**: Entity relationships and database schema
- **API Architecture**: RESTful API structure and endpoint organization
- **Frontend State Management**: Redux store structure and component interactions

### **4. Routing Architecture** (`routing-architecture.md`)
- **React Router Navigation Flow**: Route definitions and navigation patterns
- **Component State Management**: How components handle direct route access
- **Navigation Component Architecture**: UI navigation and useNavigate hook usage
- **Protected Route Implementation**: Authentication-based route protection

### **5. Deployment and DevOps** (`deployment-devops.md`)
- **Docker Deployment Architecture**: Container orchestration and networking
- **Build and Deployment Pipeline**: CI/CD workflow and quality gates
- **Environment Configuration**: Environment variables and security considerations
- **Monitoring and Observability**: Application monitoring and alerting

### **6. Database Migration System** (`migration-system.md`)
- **Unified Migration Architecture**: MigrationManager orchestration and execution flow
- **Three Migration Types**: Column additions, function handlers, and data migrations
- **Migration Patterns**: How to add new migrations for different scenarios
- **Production Deployment**: Migration behavior in GCP Cloud Run environment
- **Debugging and Troubleshooting**: Common issues and monitoring strategies

## 🎯 **How to Use These Diagrams**

### **For Developers:**
- Reference these diagrams when implementing new features
- Use them to understand data flow and component relationships
- Consult during code reviews and architectural decisions

### **For DevOps/Infrastructure:**
- Use deployment diagrams for environment setup
- Reference monitoring diagrams for observability implementation
- Follow security patterns outlined in configuration management

### **For AI Agents/Copilot:**
- These diagrams provide comprehensive context for the application
- Use them to understand the complete system when making code changes
- Reference specific flows when debugging or enhancing features

## 🔄 **Viewing Mermaid Diagrams**

### **In VS Code:**
1. Install the "Mermaid Preview" extension
2. Open any `.md` file in this folder
3. Use `Ctrl+Shift+P` → "Mermaid Preview: Open Preview"

### **In GitHub:**
- GitHub natively renders Mermaid diagrams in markdown files
- View directly in the repository browser

### **Online Tools:**
- [Mermaid Live Editor](https://mermaid.live)
- Copy diagram code and paste for editing/viewing

## 📚 **Related Documentation**

- **Root README.md**: Quick start and feature overview
- **.agents/**: Technical documentation for AI agent handoffs
- **GITHUB_SETUP.md**: Repository setup and collaboration guide

## 🔄 **Recent Architecture Updates (September 2025)**

### **Preference System Bug Fixes (September 26, 2025)**
Critical stability improvements to user preference management:
- **Race Condition Resolution**: Fixed timing dependency issues in dropdown loading by eliminating conflicting API calls
- **State Management Consistency**: Standardized immediate save pattern across QuickTest and CreateTestRun pages
- **Session Persistence**: Fixed Session ID field not saving empty values properly on QuickTest page
- **Duplicate API Prevention**: Removed conflicting useEffect hooks that caused duplicate preference PUT calls
- **Model Restoration Logic**: Fixed LLM Model preferences not restoring when Playbook is selected
- **Code Quality**: Removed all debug console.log statements while preserving essential error handling

### **Preference Persistence System**
Recent work has enhanced the user experience system with:
- **User Model Extensions**: Added `test_run_batch_size` column to User model with automated migrations
- **Timing Architecture**: Implemented `initialLoadingComplete` flags to prevent race conditions in preference loading
- **API Enhancements**: Enhanced `auth.py` endpoints with structured logging and null value handling
- **Frontend State Management**: Refined useEffect dependency management to prevent infinite loops

### **Dialogflow Service Layer**
- **Flows API Improvements**: Modified `dialogflow_service.py` to use agent names instead of ID extraction
- **Error Resolution**: Fixed 500 errors in flows endpoint that were causing UI failures

### **Debugging Infrastructure**
- **Enhanced Logging**: Comprehensive console logging system for tracking preference lifecycle
- **Developer Tools**: Added distinctive log messages for debugging timing and persistence issues

## 🔄 **Keeping Diagrams Updated**

When making significant architectural changes:
1. Update relevant diagrams in this folder
2. Ensure consistency across all documentation
3. Update version references and dates
4. Commit diagram changes with code changes

---

**Last Updated**: September 26, 2025  
**Repository**: [dialogflow-test-suite](https://github.com/your-org/dialogflow-test-suite)