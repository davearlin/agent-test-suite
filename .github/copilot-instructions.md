# Dialogflow Test Suite

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

A full-stack application for testing and evaluating Dialogflow CX agents with React frontend, FastAPI backend, PostgreSQL database, and Redis cache. The application supports automated testing workflows, LLM-powered evaluation, and real-time progress tracking.

## Working Effectively

### Test-Driven Development Requirements ⚠️ CRITICAL
**ALWAYS update or create tests when making code changes. This is not optional.**

#### Frontend Testing (Vitest + React Testing Library)
- **Location**: `frontend/src/test/`
- **Run tests**: `npm test` (in frontend directory or Docker container)
- **When to update tests**:
  - UI component changes (especially page layouts, forms, tables)
  - New features or functionality added to pages
  - Redux store or state management changes
  - API integration changes
- **Best practices**:
  - Keep tests simple - avoid complex mocking when documentation suffices
  - Use placeholder tests with comments to document manually-verified UI changes
  - Avoid MUI icon imports in tests (causes module resolution issues in Docker)
  - Mock external dependencies sparingly (APIs, router only when necessary)
  - For integration tests: Test user interactions (clicks, form submissions, accordions)
  - Use `screen.findByText` for async content, `screen.getByText` for sync content
  - Document complex UI changes in test comments when full integration testing is blocked

#### Backend Testing (Pytest)
- **Location**: `backend/tests/`
- **Run tests**: `pytest` (in backend directory)
- **When to update tests**:
  - API endpoint changes (new routes, modified responses)
  - Database model or schema changes
  - Business logic changes in services
  - New utility functions or helper methods
- **Best practices**:
  - Use fixtures for test data setup
  - Mock external services (Dialogflow, Google APIs)
  - Test both success and error cases
  - Verify database state changes
  - Test authentication and authorization

#### Test Coverage Expectations
- **All PRs must include test updates** - CI pipeline will fail if tests are broken
- **New features require new tests** - Don't just update existing tests
- **UI changes require frontend tests** - Verify the new layout/behavior
- **API changes require backend tests** - Verify request/response contracts
- **Document complex mocking strategies** - Add comments explaining why mocks are needed

### Bootstrap and Environment Setup
**NEVER CANCEL: Docker builds may take 10+ minutes. Set timeout to 20+ minutes minimum.**

The application is designed for Docker Compose but has network/SSL restrictions in some environments. Use these alternatives:

#### Primary Method (Docker Compose with Hot Reload)
```bash
# NEVER CANCEL: Full build takes 1-3 minutes. Set timeout to 20+ minutes.
docker compose build
docker compose up -d

# Check status
docker compose ps
docker compose logs -f

# HOT RELOAD: Code changes auto-reload without rebuilding!
# - Backend: uvicorn --reload watches .py files (1-3 sec reload)
# - Frontend: Vite HMR updates browser instantly (<1 sec)
# - Only rebuild when changing dependencies or Dockerfiles
```

#### Alternative Method (Direct Development)
If Docker fails due to network restrictions:
```bash
# Frontend setup - takes ~30 seconds
cd frontend
npm ci
npm run build

# Backend setup - takes ~60 seconds  
cd ../backend
pip install -r requirements.txt
```

### Database Setup
Docker Compose automatically handles database initialization. For direct development, you need PostgreSQL and Redis running locally:
```bash
# Requires PostgreSQL 15+ and Redis 7+ running locally
# Database: agent_evaluator, user: postgres, password: password
```

### Running the Application

#### Docker Method (Preferred)
```bash
# Start all services
docker compose up -d

# Access points:
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
# Default login: Use Google OAuth (all users get admin role by default)
```

#### Direct Development Method
```bash
# Terminal 1: Frontend (takes ~5 seconds to start)
cd frontend
# Configure backend target first:
# - Edit .env.local to set VITE_API_BASE_URL (see Environment Configuration section)
# - Empty = local Docker backend, Set URL = GCP backend
npm run dev
# Runs on http://localhost:3000 (note: not 3001 with new config)

# Terminal 2: Backend (only if using local backend)
cd backend
# Create .env file first (copy from .env.example)
python -m uvicorn app.main:main --host 0.0.0.0 --port 8000 --reload
```

## Build and Test Commands

### Frontend Build Process
```bash
cd frontend

# Install dependencies - takes ~30 seconds
npm ci

# Build for production - takes ~25 seconds
npm run build

# Development server - takes ~5 seconds to start  
npm run dev

# Linting - BROKEN: ESLint config missing
npm run lint  # FAILS - no ESLint configuration file exists
```

### Backend Build Process
```bash
cd backend

# Install dependencies - takes ~60 seconds
pip install -r requirements.txt

# Run tests - NO TESTS EXIST
python -m pytest --no-header -v  # Returns 0 tests collected

# Development server
python -m uvicorn app.main:main --host 0.0.0.0 --port 8000 --reload
```

### Docker Build Process
**NEVER CANCEL: Docker builds take 1-3 minutes in ideal conditions. Set timeout to 20+ minutes minimum.**
```bash
# Full build - NEVER CANCEL, takes 1-3 minutes
time docker compose build

# Individual service builds  
docker compose build backend  # Takes 1-2 minutes
docker compose build frontend # Takes 1-2 minutes
```

## Validation and Testing

### Manual Application Testing
Always test these complete scenarios after making changes:

1. **Login Flow Validation**:
   - Navigate to http://localhost:3000 (or 3001 for direct dev)
   - Login with your Google account
   - Verify dashboard loads with navigation menu

2. **Dataset Management**:
   - Navigate to Datasets page
   - Upload a CSV file from test-data/ directory
   - Verify dataset appears in list

3. **Quick Test Functionality**:
   - Use Quick Test feature with sample input
   - Verify test runs and shows results
   - Check real-time progress updates

4. **Dynamic Model Discovery Validation**:
   - Navigate to Create Test Run page
   - Verify LLM Model dropdown shows "Select from X available models" (should be 20+ models)
   - Test refresh button next to model dropdown
   - Verify models load from Google Generative AI and Vertex AI APIs
   - Check that no hardcoded fallback models appear when authentication fails

### Health Checks
```bash
# Backend health check
curl -f http://localhost:8000/health

# Frontend health check  
curl -f http://localhost:3000  # or 3001 for dev server

# Database connectivity (Docker)
docker compose exec postgres pg_isready -U postgres

# Redis connectivity (Docker)  
docker compose exec redis redis-cli ping
```

### CI/CD Validation Commands
Before committing, run:
```bash
# Frontend validation - build succeeds, lint fails
cd frontend && npm run build

# Backend validation - no actual tests exist
cd backend && python -m pytest

# Docker validation - NEVER CANCEL, set 20+ minute timeout
docker compose build --no-cache
```

## Key Implementation Notes

### Pydantic Schema Alignment
**CRITICAL**: Always ensure Pydantic schemas (`backend/app/models/schemas.py`) match database models (`backend/app/models/__init__.py`)
- Database has: `total_questions`, `completed_questions`, `average_score`, `started_at`, `completed_at`, `created_by_email`, `created_by_name`
- Schemas MUST include these fields or API responses will exclude them
- Missing fields cause "undefined" values in frontend UI

### Agent Permission System
**USER PERMISSIONS**: Users need TWO permissions for agents:
- `dialogflow.agents.get` - List agents (users typically have this)
- `dialogflow.sessions.detectIntent` - Send test messages (users often DON'T have this)
- System checks `detectIntent` permission in parallel during agent listing
- Inaccessible agents shown with "No Access" indicator, testing disabled
- Permission cache: 1-hour TTL, per-user-per-agent

### LLM Authentication System
**OAUTH-FIRST APPROACH**: LLM evaluations use user OAuth credentials for authentication
- **Priority 1**: User OAuth credentials (requires `generative-language.retriever` scope)
- **Priority 2**: API key from `GOOGLE_API_KEY` environment variable (dev/testing only)
- **Priority 3**: Application Default Credentials (ADC fallback)
- **CRITICAL**: OAuth credentials and API key are mutually exclusive - only one can be active
- **Re-authentication Required**: When OAuth scopes change, users must log out and back in
- **Scope Management**: All required scopes defined in `backend/app/api/auth.py`

**Configuration Pattern**:
```python
# CORRECT: Store auth method, configure per-request in _create_model()
self.credentials = Credentials(token=user_token)  # Store for later
# Later: genai.configure(credentials=self.credentials, api_key=None)

# WRONG: Don't configure globally at initialization
genai.configure(api_key=api_key)  # This persists and causes conflicts!
```

**Environment Variable Setup**:
- `.env` file: Comment out `GOOGLE_API_KEY` when using OAuth
- `docker-compose.yml`: Passes env vars to container, requires full restart (`docker compose down && docker compose up -d`)
- Users must re-authenticate after scope changes (OAuth tokens don't auto-update)

### Dynamic Evaluation System
**NO LEGACY FIELDS**: New test runs use ONLY dynamic parameter-based evaluation
- `TestResultParameterScore` table stores all evaluation data
- Frontend computes overall scores from parameter weights in real-time
- System supports unlimited custom evaluation parameters
**FIXED**: Race conditions causing 404 errors in page loading
**SOLUTION**: Implemented consistent immediate save pattern in onChange handlers, eliminated conflicting useEffect hooks, and standardized preference restoration logic across both pages.

### Database Migration System
**LOCATION**: Unified migration system orchestrated by `backend/app/core/migration_manager.py`
1. **MigrationManager class**: Central orchestrator in `migration_manager.py`
2. **Individual migration files**: `backend/app/core/migration_files/*.py` for complex operations
3. **Data migrations**: Defined inline in MigrationManager's migration list

**EXECUTION**: All migrations run automatically during app startup via `MigrationManager.run_migrations()`

**WHEN TO USE EACH APPROACH**:

**Use Individual Migration Files** (`backend/app/core/migration_files/`) for:
- ✅ Creating new tables
- ✅ Adding indexes
- ✅ Modifying column constraints (NOT NULL, UNIQUE, etc.)
- ✅ Complex data transformations requiring multiple queries
- ✅ Migrations that need to be reusable across environments
- ✅ Inserting seed data

**Pattern for Individual Migration Files**:
```python
# 1. Create: backend/app/core/migration_files/add_new_feature.py
from sqlalchemy import text
from app.core.database import engine

def upgrade():
    """Migration description"""
    with engine.connect() as connection:
        connection.execute(text("CREATE TABLE..."))
        connection.commit()

# 2. Add to MigrationManager.__init__ in migrations.py:
from app.core.migration_files.add_new_feature import upgrade as add_new_feature

# 3. Add to migrations list:
{
    'name': 'add_new_feature',
    'description': 'Add new feature table',
    'type': 'function',
    'handler': add_new_feature,
    'timeout': None  # or 60 for timeout
}
```

**Use Data Migrations** (in MigrationManager list) for:
- ✅ Simple data backfills (UPDATE queries)
- ✅ One-off data fixes
- ✅ Setting default values for existing NULL columns

**Pattern for Data Migrations**:
```python
# Add to MigrationManager.migrations list in migrations.py:
{
    'name': 'backfill_field_name',
    'description': 'Set default values for existing rows',
    'type': 'data',
    'sql': [
        "UPDATE table_name SET field = 0 WHERE field IS NULL",
        "UPDATE table_name SET other_field = 'default' WHERE other_field IS NULL"
    ]
}
```

**CRITICAL RULES**:
1. When adding required fields to Pydantic schemas, ALWAYS add data migration to backfill NULL values in existing database rows
2. Pydantic default values (e.g., `int = 0`) do NOT apply to existing NULL database values during validation
3. NEVER delete old migration files - they're needed for fresh deployments to new environments
4. Test migrations locally in Docker before deploying to GCP
5. All migrations must be idempotent (safe to run multiple times)

## Known Issues and Workarounds

### ESLint Configuration Missing
**ISSUE**: `npm run lint` fails with "ESLint couldn't find a configuration file"
**WORKAROUND**: Build and manual testing only. Do not rely on lint command.

### Docker Build SSL Failures  
**ISSUE**: Docker builds may fail with SSL certificate verification errors
**WORKAROUND**: Use direct development method with npm/pip commands

### No Automated Tests
**ISSUE**: No actual pytest test files exist despite test infrastructure
**WORKAROUND**: Manual functional testing required for all changes

### Database Dependencies
**ISSUE**: Backend requires PostgreSQL and Redis
**WORKAROUND**: Use Docker Compose or install locally (PostgreSQL 15+, Redis 7+)

## Technology Stack Details

### Frontend Stack
- **React 18** with TypeScript
- **Vite** build tool (replaces Create React App)
- **Material-UI** component library with dark theme
- **Redux Toolkit** for state management
- **React Router** for navigation

### Backend Stack  
- **FastAPI** with Python 3.11
- **SQLAlchemy** ORM with PostgreSQL 15
- **Pydantic** for data validation
- **Redis** for caching and session management
- **Google Cloud libraries** for Dialogflow integration

### Infrastructure
- **Docker Compose** for local development
- **PostgreSQL 15** database
- **Redis 7** cache
- **Terraform** for GCP deployment
- **GitHub Actions** for CI/CD

## Common File Locations

### Critical Configuration Files
- **Docker**: `docker-compose.yml` (main orchestration)
- **Frontend Config**: `frontend/package.json`, `frontend/vite.config.ts`
- **Backend Config**: `backend/requirements.txt`, `backend/.env.example`
- **Database Migrations**: `backend/app/core/migration_manager.py`

### API Routes
- **Authentication**: `backend/app/api/auth.py`
- **Datasets**: `backend/app/api/datasets.py` 
- **Test Execution**: `backend/app/api/tests.py`
- **Dashboard**: `backend/app/api/dashboard.py`

### Frontend Pages
- **Main App**: `frontend/src/App.tsx`
- **Login**: `frontend/src/pages/Login.tsx`
- **Dashboard**: `frontend/src/pages/Dashboard.tsx`
- **Datasets**: `frontend/src/pages/Datasets.tsx`

### State Management
- **Redux Store**: `frontend/src/store/`
- **API Services**: `frontend/src/services/api.ts`

### Test Files
- **Frontend Tests**: `frontend/src/test/`
  - `setup.ts` - Global test configuration (minimal - just jest-dom imports)
  - `App.test.tsx` - Basic app rendering tests
  - `PrePostPrompt.test.tsx` - Simplified placeholder tests documenting UI consolidation changes
  - `SimpleTest.test.tsx` - Basic validation test
  - Add new test files matching the pattern `*.test.tsx`
  - **Note**: Avoid importing MUI icons in tests (causes module resolution failures in Docker)
- **Backend Tests**: `backend/tests/`
  - `conftest.py` - Pytest fixtures and configuration
  - `test_*.py` - Test files for each module/feature
  - Use fixtures for database setup and API mocking

## Timing Expectations and Timeouts

### Command Timeouts (CRITICAL)
- **Docker Compose Build**: 20+ minutes (NEVER CANCEL)
- **npm ci**: 2 minutes  
- **npm run build**: 2 minutes
- **pip install**: 3 minutes
- **Application startup**: 1 minute

### Typical Actual Times
- **Docker full build**: 1-3 minutes
- **npm ci**: ~45 seconds
- **npm run build**: ~25 seconds  
- **pip install**: ~60 seconds
- **Services startup**: ~10 seconds

Always add 50% buffer to these times for timeout settings.

## Deployment Information

### Local Development
- **Frontend**: http://localhost:3000 (Docker) or http://localhost:3001 (dev server)
- **Backend**: http://localhost:8000  
- **API Docs**: http://localhost:8000/docs

### Production Deployment
- **Platform**: Google Cloud Platform
- **Infrastructure**: Terraform-managed
- **Services**: Cloud Run (backend), Firebase Hosting (frontend)
- **Database**: Cloud SQL PostgreSQL
- **CI/CD**: GitHub Actions with Workload Identity Federation

## Environment Variables

### Required for Local Development
```bash
# backend/.env
SECRET_KEY=test-development-secret-key-only
POSTGRES_SERVER=localhost
POSTGRES_USER=postgres  
POSTGRES_PASSWORD=password
POSTGRES_DB=agent_evaluator
REDIS_URL=redis://localhost:6379
BACKEND_CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Google Cloud Integration (Optional)
```bash
GOOGLE_CLOUD_PROJECT=your-project-id
```

### Frontend Environment Configuration
The frontend uses different environment files depending on the development scenario:

#### Local Docker Development (Default)
```bash
# frontend/.env.local (gitignored, create locally)
VITE_API_BASE_URL=
# Empty value uses Vite proxy to localhost:8000
```

#### Local Frontend + GCP Backend Development
```bash
# frontend/.env.local (gitignored, create locally)
VITE_API_BASE_URL=https://your-backend-url.run.app
# Direct API calls to GCP Cloud Run service
```

#### Production Deployment (Firebase + GCP)
```bash
# frontend/.env.production (committed to repo)
VITE_API_BASE_URL=https://your-backend-url.run.app
# Used automatically during production builds
```

**Switching Between Environments:**
1. Edit `frontend/.env.local` 
2. Comment/uncomment the `VITE_API_BASE_URL` line
3. Restart the frontend dev server (`npm run dev`)
4. Empty/undefined = uses local Docker backend via proxy
5. Set to GCP URL = bypasses proxy, calls GCP directly

## Emergency Commands

### Standard Rebuild (Preserves Data)
```bash
# STANDARD REBUILD: Stops containers, rebuilds, and restarts
# NEVER use -v flag unless explicitly requested - it destroys all data!
# NOTE: With hot reload, only rebuild when changing dependencies or Dockerfiles!
docker compose down
docker compose build --no-cache  # NEVER CANCEL: 20+ minutes
docker compose up -d
```

### Quick Restart
```bash
docker compose restart
# Or for individual services:
docker compose restart backend
docker compose restart frontend
```

### Nuclear Reset (DANGER - Only When Explicitly Requested)
```bash
# ⚠️ WARNING: DESTROYS ALL DATA - Database, volumes, everything!
# ONLY use this when user explicitly asks to delete all data
docker compose down -v
docker compose build --no-cache  # NEVER CANCEL: 20+ minutes
docker compose up -d
```

### View Logs
```bash
# All services
docker compose logs -f

# Individual service
docker compose logs -f backend
docker compose logs -f frontend
```

### Database Reset
```bash
# Reset database only
docker compose down
docker volume rm dialogflow-test-suite_postgres_data
docker compose up -d
```