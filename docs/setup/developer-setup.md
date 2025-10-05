# New Developer Setup Guide

## 🚀 Quick Start for New Developers

This guide walks you through setting up the Dialogflow Test Suite from scratch.

### Prerequisites

- **Docker Desktop** installed and running
- **Git** installed  
- **PowerShell** or Command Prompt
- **Google Cloud Platform account** (for production use)

### 1. Clone the Repository

```powershell
git clone https://github.com/your-org/dialogflow-test-suite.git
cd dialogflow-test-suite
```

### 2. Start the Application

```powershell
docker-compose up -d
```

That's it! The application will:
- ✅ **Build all containers** (backend, frontend, database, Redis for local caching)
- ✅ **Initialize the database** with all required tables
- ✅ **Run migrations automatically** to ensure all columns exist
- ✅ **All users get admin role** (via Google OAuth)

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### 4. Configure Google OAuth (Required for Login)

**⚠️ IMPORTANT**: There is NO default admin account. All authentication is via Google OAuth SSO.

You **must** configure Google OAuth to login and use the application:

1. **Follow the OAuth setup guide**: See `docs/setup/oauth-setup.md` for detailed instructions

2. **Create `.env` file in project root** (not in backend/ or frontend/):
   ```powershell
   # From project root: dialogflow-test-suite/
   cp .env.example .env
   ```

3. **Edit `.env`** (in project root) with your OAuth credentials:
   ```bash
   # Required for login:
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/callback
   
   # Optional - for Dialogflow testing:
   GOOGLE_CLOUD_PROJECT=your-gcp-project-id
   GOOGLE_API_KEY=your-google-api-key
   ```

4. **Restart containers** to pick up environment variables:
   ```powershell
   docker-compose down
   docker-compose up -d
   ```

**File Locations:**
- ✅ **`/.env`** (project root) - Used by docker-compose - **THIS IS THE ONE YOU NEED**
- ❌ `/backend/.env` - Only for direct Python development (not needed for Docker)
- ✅ `/frontend/.env.local` - Already configured for local Docker backend (no changes needed)

**How Authentication Works:**
- Users login with their Google accounts
- First-time users are automatically created in the database
- Role assignment:
  - All authenticated users → **admin** role (by default)
  - Other domains → **viewer** role

### 5. Understanding Environment Files

**Three `.env` files exist in different locations:**

1. **`/.env`** (project root)
   - Purpose: Used by `docker-compose.yml` to pass variables to containers
   - Status: **REQUIRED for Docker development**
   - Setup: Copy from `/.env.example`

2. **`/backend/.env`** 
   - Purpose: Used when running Python backend directly (without Docker)
   - Status: **NOT needed for Docker** (docker-compose provides env vars)
   - Setup: Copy from `/backend/.env.example` (only if running Python directly)

3. **`/frontend/.env.local`**
   - Purpose: Controls which backend frontend talks to
   - Status: Already configured for local Docker
   - Setup: No changes needed (empty value = local Docker backend)

**For Docker development, you ONLY need the root `/.env` file!**

### 6. Additional Documentation

**Detailed Setup Guides:**
- 📖 **`docs/setup/oauth-setup.md`** - Configure OAuth for Google login (REQUIRED)
- 📖 **`docs/setup/google-auth.md`** - Set up Google Cloud project and API keys
- 📖 **`docs/oauth-environment-variables.md`** - Complete environment variable reference
- 📖 **`frontend/ENVIRONMENT_CONFIG.md`** - Frontend environment configuration details

**Production Note**: In production, OAuth is automatically configured via GitHub Actions and Terraform. No manual setup required for deployed environments.

## 🔧 Database Migration System

### Automatic Migrations

The application now includes an **automated migration system** that runs on startup:

1. **Base Tables**: Created using SQLAlchemy models (`Base.metadata.create_all()`)
2. **Column Migrations**: Automatically applied using the migration manager
3. **Error Handling**: Migrations skip columns that already exist
4. **Logging**: Detailed logs show what migrations are being applied

### What Gets Migrated

The system automatically ensures these columns exist:

#### Users Table
- **Google OAuth**: `google_access_token`, `google_refresh_token`, `google_token_expires_at`
- **Quick Test Preferences**: `quick_test_project_id`, `quick_test_agent_id`, `quick_test_flow_id`, `quick_test_page_id`, `quick_test_session_id`, `quick_test_session_parameters`
- **Test Run Preferences**: `test_run_project_id`, `test_run_agent_id`, `test_run_flow_id`, `test_run_page_id`, `test_run_playbook_id`, `test_run_llm_model_id`, `test_run_session_parameters`

#### Test Runs Table
- **Display Names**: `agent_display_name`, `flow_display_name`, `page_display_name`, `playbook_display_name`
- **Session Support**: `session_parameters`
- **Playbook Support**: `playbook_id`, `llm_model_id`

### Fresh vs Existing Database

**Fresh Database (New Developer)**:
- SQLAlchemy creates all tables with the complete schema
- Migration system runs but finds all columns already exist
- Everything works perfectly out of the box

**Existing Database (Upgrading)**:
- Migration system detects missing columns and adds them
- Existing data is preserved
- New functionality becomes available immediately

## 🐳 Docker Container Behavior

### First-Time Startup
```
1. PostgreSQL container starts and initializes empty database
2. Backend container builds and starts
3. SQLAlchemy creates all base tables
4. Migration system adds any missing columns
5. Default admin user is created
6. Frontend container serves the React app
```

### Subsequent Startups
```
1. All containers start quickly (no rebuild needed)
2. Database persists in Docker volume
3. Migration system checks for new columns (usually none)
4. Application is ready in seconds
```

## 🔍 Troubleshooting

### Database Issues

If you encounter database problems:

```powershell
# Reset everything (nuclear option)
docker-compose down -v  # This deletes the database volume
docker-compose up -d    # Recreates everything fresh
```

### Check Migration Logs

```powershell
# View backend startup logs
docker-compose logs backend

# Look for migration messages like:
# 🔧 Initializing database...
# ✅ Base tables created  
# 🔄 Running database migrations...
# ✅ Added column users.test_run_project_id
# 🎉 All migrations completed successfully!
```

### Manual Migration (If Needed)

If you need to run migrations manually:

```powershell
# Connect to the backend container
docker-compose exec backend python -m app.core.migration_manager
```

## 📂 Project Structure

```
dialogflow-test-suite/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── migrations.py      # ← New automated migration system
│   │   │   ├── database.py
│   │   │   └── config.py
│   │   ├── models/
│   │   │   └── __init__.py        # ← Complete User model with all preference columns
│   │   ├── api/
│   │   │   └── auth.py            # ← Test Run preferences endpoints
│   │   └── main.py                # ← Calls migration system on startup
│   ├── migrations/                # ← Legacy manual migration scripts
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   └── CreateTestRunPage.tsx  # ← Comprehensive preferences system
│   │   ├── types/
│   │   │   └── index.ts           # ← TestRunPreferences interface
│   │   └── services/
│   │       └── api.ts             # ← Preferences API methods
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## ✅ Success Indicators

When everything is working correctly, you should see:

1. **Backend Logs**: Migration success messages
2. **Frontend**: Loads at http://localhost:3000
3. **API Docs**: Available at http://localhost:8000/docs
4. **Database**: All tables and columns exist
5. **Preferences**: Quick Test and Create Test Run settings persist automatically