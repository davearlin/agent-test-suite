# Contributing to Dialogflow Test Suite

Thank you for your interest in contributing to the Dialogflow Test Suite! This document provides guidelines and instructions for contributing to this project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)

## 🤝 Code of Conduct

This project follows a standard code of conduct:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences

## 🚀 Getting Started

### Prerequisites

- Docker Desktop installed and running
- Git for version control
- Node.js 20+ and Python 3.11+ (for local development without Docker)
- Google Cloud Platform account (for testing Dialogflow features)

### Initial Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/agent-test-suite.git
   cd agent-test-suite
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/davearlin/agent-test-suite.git
   ```

4. **Start the development environment**:
   ```bash
   docker compose up -d
   ```

5. **Verify everything works**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000/docs

## 🔄 Development Workflow

### Branch Strategy

- `main` - Production-ready code (protected, no direct commits)
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates
- `refactor/*` - Code refactoring

### Creating a Feature Branch

```bash
# Make sure you're on main and up to date
git checkout main
git pull upstream main

# Create and switch to a new feature branch
git checkout -b feature/your-feature-name

# Make your changes...

# Commit your changes
git add .
git commit -m "Add descriptive commit message"

# Push to your fork
git push origin feature/your-feature-name
```

### Keeping Your Branch Up to Date

```bash
# Fetch latest changes from upstream
git fetch upstream

# Rebase your branch on top of upstream/main
git rebase upstream/main

# Force push to your fork (if already pushed)
git push origin feature/your-feature-name --force-with-lease
```

## 🔍 Pull Request Process

### Before Submitting

1. **Test your changes locally**:
   ```bash
   # Backend tests
   cd backend
   pytest
   
   # Frontend tests
   cd frontend
   npm test
   
   # Full integration test with Docker
   docker compose up -d
   ```

2. **Ensure code follows style guidelines**:
   ```bash
   # Backend linting (Python)
   cd backend
   black app/
   flake8 app/
   
   # Frontend linting (TypeScript/React)
   cd frontend
   npm run lint
   ```

3. **Update documentation** if you've changed:
   - API endpoints
   - Configuration options
   - User-facing features
   - Installation/setup procedures

### Submitting a Pull Request

1. **Push your branch** to your fork on GitHub

2. **Create a Pull Request**:
   - Go to https://github.com/davearlin/agent-test-suite
   - Click "Pull requests" → "New pull request"
   - Click "compare across forks"
   - Select your fork and branch
   - Fill out the PR template with:
     - **Description**: What does this PR do?
     - **Related Issues**: Link any related issues
     - **Testing**: How did you test this?
     - **Screenshots**: If UI changes, include screenshots

3. **PR Title Format**:
   ```
   feat: Add webhook control to Quick Test page
   fix: Resolve database connection timeout issue
   docs: Update OAuth setup instructions
   refactor: Simplify LLM evaluation service
   test: Add integration tests for test runs
   ```

4. **Wait for Review**:
   - At least 1 approval required
   - CI checks must pass
   - All conversations must be resolved

5. **Address Feedback**:
   ```bash
   # Make requested changes
   git add .
   git commit -m "Address review feedback"
   git push origin feature/your-feature-name
   ```

6. **After Merge**:
   ```bash
   # Update your main branch
   git checkout main
   git pull upstream main
   
   # Delete your feature branch
   git branch -d feature/your-feature-name
   git push origin --delete feature/your-feature-name
   ```

## 📝 Coding Standards

### Python (Backend)

- Follow PEP 8 style guide
- Use type hints for function parameters and return values
- Use `black` for code formatting
- Maximum line length: 100 characters
- Use descriptive variable and function names

**Example**:
```python
from typing import List, Optional
from pydantic import BaseModel

async def get_test_runs(
    user_id: int,
    status: Optional[str] = None,
    limit: int = 50
) -> List[TestRun]:
    """Retrieve test runs for a specific user.
    
    Args:
        user_id: The ID of the user
        status: Optional status filter
        limit: Maximum number of results
        
    Returns:
        List of TestRun objects
    """
    # Implementation
```

### TypeScript/React (Frontend)

- Use TypeScript for all new code
- Follow React best practices and hooks patterns
- Use functional components over class components
- Use Material-UI components consistently
- Maximum line length: 100 characters

**Example**:
```typescript
interface TestRunListProps {
  testRuns: TestRun[];
  onSelectRun: (runId: number) => void;
  isLoading?: boolean;
}

export const TestRunList: React.FC<TestRunListProps> = ({
  testRuns,
  onSelectRun,
  isLoading = false,
}) => {
  // Component implementation
};
```

### Git Commit Messages

Format: `type: subject`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Example**:
```
feat: Add multi-parameter evaluation system
fix: Resolve race condition in test result updates
docs: Update deployment guide with Terraform instructions
```

## 🧪 Testing Requirements

### Backend Tests

All new backend features must include tests:

```bash
cd backend
pytest tests/test_your_feature.py -v
```

**Required test coverage**:
- API endpoints: Request/response validation
- Business logic: Service layer functions
- Database operations: CRUD operations
- Error handling: Edge cases and error scenarios

### Frontend Tests

All new UI components should include tests:

```bash
cd frontend
npm test
```

**Testing approach**:
- Component rendering tests
- User interaction tests (clicks, form submissions)
- Redux state management tests
- API integration tests (mocked)

### Integration Tests

For significant features, add Docker-based integration tests:

```bash
# Start test environment
docker compose up -d

# Run integration tests
python test_integration.py
```

## 📚 Documentation

### Code Documentation

- **Python**: Use docstrings for all functions, classes, and modules
- **TypeScript**: Use JSDoc comments for complex functions
- **README**: Update if adding new features or changing setup

### User Documentation

Update relevant documentation in the `docs/` directory:

- `docs/guides/` - User guides and tutorials
- `docs/setup/` - Installation and configuration
- `docs/features/` - Feature documentation

### API Documentation

- Backend API is auto-documented via FastAPI
- Update endpoint descriptions and examples
- Document request/response schemas

## ❓ Questions or Issues?

- **Bug Reports**: Open an issue with detailed reproduction steps
- **Feature Requests**: Open an issue describing the feature and use case
- **Questions**: Open a discussion or issue for clarification

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project.

---

**Thank you for contributing to the Dialogflow Test Suite!** 🎉
