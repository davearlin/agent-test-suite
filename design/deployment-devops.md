# Deployment and DevOps Architecture - Dialogflow Test Suite ✅ IMPLEMENTED

## ✅ Production CI/CD Pipeline - ACTIVE DEPLOYMENT

**Status**: Infrastructure deployed and operational  
**Project**: `your-gcp-project-id`  
**Database**: `dialogflow-tester-postgres-dev` (RUNNABLE)  
**GitHub Secrets**: Configured for automated deployment  

```mermaid
graph TB
    subgraph "GitHub Repository"
        MAIN_BRANCH[main branch]
        DEV_BRANCH[develop branch] 
        PR[Pull Request]
        ACTIONS[GitHub Actions ✅]
    end
    
    subgraph "Workload Identity Federation ✅ CONFIGURED"
        WIF_POOL[github-actions-pool]
        WIF_PROVIDER[github-provider]
        SERVICE_ACCOUNT[github-actions-dialogflow@your-gcp-project-id]
    end
    
    subgraph "Google Cloud Platform ✅ DEPLOYED"
        subgraph "Development Environment ✅ ACTIVE"
            DEV_CLOUD_RUN[Cloud Run Dev ✅ OPERATIONAL]
            DEV_CLOUD_SQL[Cloud SQL Dev ✅ OPERATIONAL]
            DEV_VPC[VPC Network ✅ CONFIGURED]
            DEV_FIREBASE[Firebase Hosting ✅ DEPLOYED]
        end
        
        subgraph "Production Environment 🚀 READY"
            PROD_CLOUD_RUN[Cloud Run Prod - Configured]
            PROD_CLOUD_SQL[Cloud SQL Prod - Configured]
            PROD_FIREBASE[Firebase Hosting - Ready]
        end
        
        TERRAFORM[Terraform State ✅ MANAGED]
    end
    
    subgraph "CI/CD Workflow ✅ IMPLEMENTED"
        BUILD[Build & Test Docker Images]
        DEPLOY_INFRA[Deploy Infrastructure ✅ DONE]
        DEPLOY_BACKEND[Deploy Backend to Cloud Run ✅ DEPLOYED]
        DEPLOY_FRONTEND[Deploy Frontend to Firebase ✅ DEPLOYED]
        HEALTH_CHECK[Health Checks ✅ PASSING]
    end
    
    MAIN_BRANCH --> ACTIONS
    DEV_BRANCH --> ACTIONS
    PR --> BUILD
    
    ACTIONS --> WIF_POOL
    WIF_POOL --> WIF_PROVIDER
    WIF_PROVIDER --> SERVICE_ACCOUNT
    
    SERVICE_ACCOUNT --> DEPLOY_INFRA
    SERVICE_ACCOUNT --> DEPLOY_BACKEND
    SERVICE_ACCOUNT --> DEPLOY_FRONTEND
    
    DEPLOY_INFRA --> DEV_CLOUD_SQL
    DEPLOY_INFRA --> DEV_VPC
    DEPLOY_INFRA --> TERRAFORM
    
    DEPLOY_BACKEND --> DEV_CLOUD_RUN
    DEPLOY_FRONTEND --> DEV_FIREBASE
    
    DEV_CLOUD_RUN --> HEALTH_CHECK
    DEV_FIREBASE --> HEALTH_CHECK
    
    HEALTH_CHECK --> DEV_CLOUD_SQL
```

## Current Infrastructure Status

### ✅ Deployed Components
- **Backend**: `https://dialogflow-tester-backend-dev-hs2q4zkodq-uc.a.run.app` (Cloud Run, HEALTHY)
- **Frontend**: `https://your-frontend-url.web.app` (Firebase Hosting)
- **Database**: `dialogflow-tester-postgres-dev` (PostgreSQL 15, VPC-connected)
- **Session Management**: In-memory sessions (cost-optimized, ~$26/month savings)
- **Networking**: VPC with subnet and connector (`df-tester-connector`)
- **Security**: Auto-generated database passwords, VPC isolation, OAuth integration
- **GitHub Integration**: Repository secrets configured for automation

### 🎯 Recent Optimizations (September 2025 - October 2025)
- **Cost Reduction**: Removed Redis cache infrastructure (~$26/month savings)
- **Architecture Simplification**: Migrated to in-memory session management
- **API Consistency**: Fixed frontend URL construction errors
- **Authentication Architecture**: 
  - **OAuth-First**: User authentication via Google OAuth (user's own credentials)
  - **Dynamic Model Discovery**: LLM models discovered via API, not hardcoded
  - **Removed Environment Variables**: `GEMINI_MODEL` and `GOOGLE_APPLICATION_CREDENTIALS` removed (unnecessary with OAuth-first approach)
  - **ADC Support**: Application Default Credentials (ADC) used automatically in GCP environments
- **Infrastructure as Code**: Implemented complete Terraform state management with resource imports
- **OAuth Automation**: Automated OAuth secret management via GitHub Actions TF_VAR variables
- **Environment Variables**: Fixed Vite environment variable precedence issues (.env.local override handling)
- **Deployment Pipeline**: Fully automated GitHub Actions workflow with Terraform and Firebase deployment
    
    SERVICE_ACCOUNT --> BUILD
    BUILD --> DEPLOY_INFRA
    DEPLOY_INFRA --> TERRAFORM
    TERRAFORM --> VPC
    
    VPC --> DEV_CLOUD_SQL
    VPC --> DEV_REDIS
    VPC --> PROD_CLOUD_SQL
    VPC --> PROD_REDIS
    
    DEPLOY_INFRA --> DEPLOY_APP
    DEPLOY_APP --> DEV_CLOUD_RUN
    DEPLOY_APP --> PROD_CLOUD_RUN
    DEPLOY_APP --> HEALTH_CHECK
    
    style WIF_POOL fill:#e8f5e8
    style SERVICE_ACCOUNT fill:#fff3e0
    style TERRAFORM fill:#e3f2fd
    style HEALTH_CHECK fill:#e1f5fe
```

## Security Architecture - Workload Identity Federation

```mermaid
graph TB
    subgraph "GitHub Actions Runner"
        RUNNER[GitHub Runner]
        OIDC_TOKEN[OIDC Token]
    end
    
    subgraph "Google Cloud IAM"
        WIF_POOL[github-actions-pool]
        WIF_PROVIDER[github-provider]
        
        subgraph "Service Account Permissions"
            CLOUD_RUN_ADMIN[Cloud Run Admin]
            CLOUD_SQL_CLIENT[Cloud SQL Client]
            FIREBASE_ADMIN[Firebase Admin]
            NETWORK_ADMIN[Network Admin]
            STORAGE_ADMIN[Storage Admin]
            SECRET_ACCESSOR[Secret Accessor]
        end
        
        SA[github-actions-dialogflow]
    end
    
    subgraph "Repository Security"
        REPO_RESTRICTION[Repository: your-org/dialogflow-test-suite]
        BRANCH_RESTRICTION[Branch: main/develop]
    end
    
    RUNNER --> OIDC_TOKEN
    OIDC_TOKEN --> WIF_PROVIDER
    WIF_PROVIDER --> REPO_RESTRICTION
    REPO_RESTRICTION --> BRANCH_RESTRICTION
    BRANCH_RESTRICTION --> WIF_POOL
    WIF_POOL --> SA
    
    SA --> CLOUD_RUN_ADMIN
    SA --> CLOUD_SQL_CLIENT
    SA --> FIREBASE_ADMIN
    SA --> NETWORK_ADMIN
    SA --> STORAGE_ADMIN
    SA --> SECRET_ACCESSOR
    
    style OIDC_TOKEN fill:#e8f5e8
    style REPO_RESTRICTION fill:#fff3e0
    style SA fill:#e3f2fd
```

## Docker Deployment Architecture

```mermaid
graph TB
    subgraph "Development Environment"
        DEV_CODE[Source Code]
        DEV_ENV[.env files with OAuth credentials]
        OAUTH_CONFIG[Google OAuth Configuration]
    end
    
    subgraph "Docker Compose Orchestration"
        COMPOSE[docker-compose.yml]
        
        subgraph "Frontend Container"
            FE_BUILD[Node.js Build Process]
            FE_NGINX[Nginx Web Server]
            FE_STATIC[React Static Files]
        end
        
        subgraph "Backend Container"
            BE_PYTHON[Python Runtime]
            BE_FASTAPI[FastAPI Application]
            BE_DEPS[Python Dependencies]
            BE_OAUTH[OAuth Authentication Handler]
        end
        
        subgraph "Shared Volumes"
            VOL_FE[./frontend:/app]
            VOL_BE[./backend:/app]
            VOL_DB[PostgreSQL Database]
        end
    end
    
    subgraph "Network Layer"
        NETWORK[Docker Network]
        PORT_3000[Port 3000 - Frontend]
        PORT_8000[Port 8000 - Backend API]
    end
    
    subgraph "Authentication Flow"
        USER_LOGIN[User Google Login]
        OAUTH_TOKEN[OAuth Token Storage]
        GCP_APIS[Google Cloud APIs]
    end
    
    DEV_CODE --> COMPOSE
    DEV_ENV --> COMPOSE
    OAUTH_CONFIG --> DEV_ENV
    
    COMPOSE --> FE_BUILD
    COMPOSE --> BE_PYTHON
    
    FE_BUILD --> FE_NGINX
    FE_NGINX --> FE_STATIC
    
    BE_PYTHON --> BE_FASTAPI
    BE_FASTAPI --> BE_DEPS
    BE_FASTAPI --> BE_OAUTH
    
    VOL_FE --> FE_BUILD
    VOL_BE --> BE_PYTHON
    VOL_DB --> BE_FASTAPI
    
    USER_LOGIN --> BE_OAUTH
    BE_OAUTH --> OAUTH_TOKEN
    OAUTH_TOKEN --> GCP_APIS
    
    FE_NGINX --> PORT_3000
    BE_FASTAPI --> PORT_8000
    
    PORT_3000 --> NETWORK
    PORT_8000 --> NETWORK
    
    style FE_BUILD fill:#e3f2fd
    style BE_FASTAPI fill:#f3e5f5
    style VOL_DB fill:#e8f5e8
    style BE_OAUTH fill:#4caf50
    style OAUTH_TOKEN fill:#8bc34a
    style OAUTH_CONFIG fill:#fff3e0
```

**Architecture Note**: This deployment uses **OAuth-first authentication**:
- ❌ **No service account JSON files** mounted to containers
- ❌ **No GOOGLE_APPLICATION_CREDENTIALS** environment variable needed
- ✅ **User OAuth credentials** from Google login provide authentication
- ✅ **ADC (Application Default Credentials)** automatically used in GCP environments
- ✅ **Optional GOOGLE_API_KEY** for development/testing without OAuth
```

## Complete Deployment Flow - All Targets

```mermaid
graph TB
    subgraph "Source & Triggers"
        DEVELOPER[Developer Push]
        MAIN_BRANCH[main branch]
        GITHUB_ACTIONS[GitHub Actions Workflow]
    end
    
    subgraph "Authentication & Setup"
        WIF_AUTH[Workload Identity Federation]
        SERVICE_ACCOUNT[github-actions-dialogflow SA]
        GCP_AUTH[GCP Authentication]
    end
    
    subgraph "Build Processes"
        FRONTEND_BUILD[Frontend Build Process]
        BACKEND_BUILD[Backend Build Process]
        
        subgraph "Frontend Pipeline"
            FB_INSTALL[npm install]
            FB_BUILD[npm run build]
            FB_DIST[dist/ output]
        end
        
        subgraph "Backend Pipeline"
            BB_DOCKER[Docker Build]
            BB_IMAGE[Container Image]
            BB_REGISTRY[Push to Artifact Registry]
        end
    end
    
    subgraph "Infrastructure Deployment"
        TERRAFORM_APPLY[Terraform Apply]
        
        subgraph "Infrastructure Targets"
            CLOUD_SQL_DEPLOY[Cloud SQL Database]
            VPC_DEPLOY[VPC Network]
            CLOUD_RUN_SERVICE[Cloud Run Service]
        end
    end
    
    subgraph "Application Deployment"
        subgraph "Firebase Hosting Deployment"
            FIREBASE_DEPLOY[Firebase Deploy]
            FIREBASE_HOSTING[Firebase Hosting]
            STATIC_HOSTING[Static React App]
        end
        
        subgraph "Cloud Run Deployment"
            CLOUDRUN_DEPLOY[Cloud Run Deploy]
            CONTAINER_REGISTRY[Artifact Registry]
            BACKEND_SERVICE[FastAPI Backend]
        end
    end
    
    subgraph "Live Production Services"
        LIVE_FRONTEND[🌐 your-frontend-url.web.app]
        LIVE_BACKEND[🚀 dialogflow-tester-backend-dev-*.a.run.app]
        LIVE_DATABASE[🗄️ dialogflow-tester-postgres-dev]
    end
    
    %% Flow connections
    DEVELOPER --> MAIN_BRANCH
    MAIN_BRANCH --> GITHUB_ACTIONS
    
    GITHUB_ACTIONS --> WIF_AUTH
    WIF_AUTH --> SERVICE_ACCOUNT
    SERVICE_ACCOUNT --> GCP_AUTH
    
    GCP_AUTH --> FRONTEND_BUILD
    GCP_AUTH --> BACKEND_BUILD
    GCP_AUTH --> TERRAFORM_APPLY
    
    %% Frontend Build Flow
    FRONTEND_BUILD --> FB_INSTALL
    FB_INSTALL --> FB_BUILD
    FB_BUILD --> FB_DIST
    FB_DIST --> FIREBASE_DEPLOY
    FIREBASE_DEPLOY --> FIREBASE_HOSTING
    FIREBASE_HOSTING --> STATIC_HOSTING
    STATIC_HOSTING --> LIVE_FRONTEND
    
    %% Backend Build Flow
    BACKEND_BUILD --> BB_DOCKER
    BB_DOCKER --> BB_IMAGE
    BB_IMAGE --> BB_REGISTRY
    BB_REGISTRY --> CONTAINER_REGISTRY
    CONTAINER_REGISTRY --> CLOUDRUN_DEPLOY
    CLOUDRUN_DEPLOY --> BACKEND_SERVICE
    BACKEND_SERVICE --> LIVE_BACKEND
    
    %% Infrastructure Flow
    TERRAFORM_APPLY --> CLOUD_SQL_DEPLOY
    TERRAFORM_APPLY --> VPC_DEPLOY
    TERRAFORM_APPLY --> CLOUD_RUN_SERVICE
    CLOUD_SQL_DEPLOY --> LIVE_DATABASE
    CLOUD_RUN_SERVICE --> LIVE_BACKEND
    VPC_DEPLOY --> LIVE_DATABASE
    
    %% Service Connections
    LIVE_FRONTEND -.-> LIVE_BACKEND
    LIVE_BACKEND -.-> LIVE_DATABASE
    
    style LIVE_FRONTEND fill:#e1f5fe
    style LIVE_BACKEND fill:#f3e5f5
    style LIVE_DATABASE fill:#e8f5e8
    style GITHUB_ACTIONS fill:#fff3e0
```

## GitHub Actions CI/CD Pipeline

```mermaid
graph TB
    subgraph "Trigger Events"
        PUSH_MAIN[Push to main]
        PUSH_DEV[Push to develop]
        PULL_REQUEST[Pull Request]
    end
    
    subgraph "Environment Detection"
        ENV_CHECK{Branch Check}
        SET_DEV[Environment: development]
        SET_PROD[Environment: production]
    end
    
    subgraph "Build & Test Stage"
        CHECKOUT[Checkout Code]
        NODE_SETUP[Setup Node.js]
        PYTHON_SETUP[Setup Python]
        INSTALL_DEPS[Install Dependencies]
        RUN_TESTS[Run Tests]
        BUILD_FRONTEND_STEP[Build Frontend Assets]
        BUILD_CONTAINERS[Build Backend Containers]
    end
    
    subgraph "Authentication"
        WIF_AUTH[Workload Identity Federation]
        GCP_AUTH[Authenticate to GCP]
    end
    
    subgraph "Infrastructure Deployment"
        TERRAFORM_INIT[terraform init]
        TERRAFORM_PLAN[terraform plan]
        TERRAFORM_APPLY[terraform apply]
    end
    
    subgraph "Application Deployment"
        subgraph "Frontend Deployment"
            BUILD_FRONTEND[Build React App]
            FIREBASE_DEPLOY[Deploy to Firebase Hosting]
            FRONTEND_LIVE[Frontend Live ✅]
        end
        
        subgraph "Backend Deployment"
            PUSH_IMAGES[Push Container Images]
            DEPLOY_CLOUD_RUN[Deploy to Cloud Run]
            BACKEND_LIVE[Backend Live ✅]
        end
        
        UPDATE_SECRETS[Update Application Secrets]
    end
    
    subgraph "Post-Deployment"
        HEALTH_CHECKS[Application Health Checks]
        SMOKE_TESTS[Smoke Tests]
        NOTIFY[Notify Team]
    end
    
    PUSH_MAIN --> ENV_CHECK
    PUSH_DEV --> ENV_CHECK
    PULL_REQUEST --> CHECKOUT
    
    ENV_CHECK -->|main| SET_PROD
    ENV_CHECK -->|develop| SET_DEV
    ENV_CHECK -->|PR| CHECKOUT
    
    SET_PROD --> CHECKOUT
    SET_DEV --> CHECKOUT
    
    CHECKOUT --> NODE_SETUP
    NODE_SETUP --> PYTHON_SETUP
    PYTHON_SETUP --> INSTALL_DEPS
    INSTALL_DEPS --> RUN_TESTS
    RUN_TESTS --> BUILD_FRONTEND_STEP
    BUILD_FRONTEND_STEP --> BUILD_CONTAINERS
    BUILD_CONTAINERS --> WIF_AUTH
    
    WIF_AUTH --> GCP_AUTH
    GCP_AUTH --> TERRAFORM_INIT
    TERRAFORM_INIT --> TERRAFORM_PLAN
    TERRAFORM_PLAN --> TERRAFORM_APPLY
    
    TERRAFORM_APPLY --> BUILD_FRONTEND
    TERRAFORM_APPLY --> PUSH_IMAGES
    
    BUILD_FRONTEND --> FIREBASE_DEPLOY
    FIREBASE_DEPLOY --> FRONTEND_LIVE
    
    PUSH_IMAGES --> DEPLOY_CLOUD_RUN
    DEPLOY_CLOUD_RUN --> BACKEND_LIVE
    
    FRONTEND_LIVE --> UPDATE_SECRETS
    BACKEND_LIVE --> UPDATE_SECRETS
    
    UPDATE_SECRETS --> HEALTH_CHECKS
    HEALTH_CHECKS --> SMOKE_TESTS
    SMOKE_TESTS --> NOTIFY
    
    style WIF_AUTH fill:#e8f5e8
    style GCP_AUTH fill:#fff3e0
    style TERRAFORM_APPLY fill:#e3f2fd
    style HEALTH_CHECKS fill:#e1f5fe
    style FIREBASE_DEPLOY fill:#ffeb3b
    style FRONTEND_LIVE fill:#4caf50
    style BACKEND_LIVE fill:#2196f3
```

## Multi-Environment Architecture

```mermaid
graph TB
    subgraph "Development Environment"
        DEV_PROJECT[your-gcp-project-id]
        
        subgraph "Dev Resources"
            DEV_CR[Cloud Run Dev ✅]
            DEV_SQL[db-f1-micro ✅]
            DEV_VPC[VPC Dev ✅]
            DEV_FIREBASE[Firebase Hosting ✅]
        end
    end
    
    subgraph "Production Environment"
        PROD_PROJECT[Production Project]
        
        subgraph "Prod Resources"
            PROD_CR[Cloud Run Prod]
            PROD_SQL[db-n1-standard-2]
            PROD_VPC[VPC Prod]
            PROD_FIREBASE[Firebase Hosting]
        end
    end
    
    subgraph "Shared Resources"
        ARTIFACT_REGISTRY[Artifact Registry]
        WIF_POOL[Workload Identity Pool]
        SERVICE_ACCOUNT[Service Account]
    end
    
    subgraph "GitHub Actions"
        WORKFLOW[deploy.yml]
        SECRETS[Repository Secrets]
    end
    
    WORKFLOW --> WIF_POOL
    SECRETS --> WIF_POOL
    WIF_POOL --> SERVICE_ACCOUNT
    SERVICE_ACCOUNT --> ARTIFACT_REGISTRY
    
    SERVICE_ACCOUNT --> DEV_PROJECT
    SERVICE_ACCOUNT --> PROD_PROJECT
    
    DEV_PROJECT --> DEV_CR
    DEV_PROJECT --> DEV_SQL
    DEV_PROJECT --> DEV_VPC
    DEV_PROJECT --> DEV_FIREBASE
    
    PROD_PROJECT --> PROD_CR
    PROD_PROJECT --> PROD_SQL
    PROD_PROJECT --> PROD_VPC
    PROD_PROJECT --> PROD_FIREBASE
    
    ARTIFACT_REGISTRY --> DEV_CR
    ARTIFACT_REGISTRY --> PROD_CR
    
    style DEV_PROJECT fill:#e8f5e8
    style PROD_PROJECT fill:#fff3e0
    style SERVICE_ACCOUNT fill:#e3f2fd
```

## Build and Deployment Pipeline

```mermaid
graph TB
    subgraph "Development Workflow"
        CODE_CHANGE[Code Changes]
        LOCAL_TEST[Local Testing]
        GIT_COMMIT[Git Commit]
        GIT_PUSH[Git Push to GitHub]
    end
    
    subgraph "Container Build Process"
        BUILD_TRIGGER[Build Trigger]
        
        subgraph "Frontend Build"
            FE_INSTALL[npm install]
            FE_BUILD[npm run build]
            FE_DOCKER[Docker Build Frontend]
        end
        
        subgraph "Backend Build"
            BE_DEPS[pip install requirements]
            BE_DOCKER[Docker Build Backend]
        end
    end
    
    subgraph "Deployment Stages"
        LOCAL_DEPLOY[Local Docker Compose]
        STAGING[Staging Environment]
        PRODUCTION[Production Environment]
    end
    
    subgraph "Quality Gates"
        TYPE_CHECK[TypeScript Compilation]
        LINT_CHECK[Code Linting]
        TEST_SUITE[Unit Tests]
        INTEGRATION_TEST[Integration Tests]
    end
    
    CODE_CHANGE --> LOCAL_TEST
    LOCAL_TEST --> TYPE_CHECK
    TYPE_CHECK --> LINT_CHECK
    LINT_CHECK --> TEST_SUITE
    TEST_SUITE --> GIT_COMMIT
    GIT_COMMIT --> GIT_PUSH
    
    GIT_PUSH --> BUILD_TRIGGER
    BUILD_TRIGGER --> FE_INSTALL
    BUILD_TRIGGER --> BE_DEPS
    
    FE_INSTALL --> FE_BUILD
    FE_BUILD --> FE_DOCKER
    BE_DEPS --> BE_DOCKER
    
    FE_DOCKER --> LOCAL_DEPLOY
    BE_DOCKER --> LOCAL_DEPLOY
    LOCAL_DEPLOY --> INTEGRATION_TEST
    INTEGRATION_TEST --> STAGING
    STAGING --> PRODUCTION
    
    style CODE_CHANGE fill:#e8f5e8
    style TYPE_CHECK fill:#e3f2fd
    style LOCAL_DEPLOY fill:#fff3e0
    style PRODUCTION fill:#e1f5fe
```

## Authentication & Authorization Architecture

```mermaid
graph TB
    subgraph "User Authentication (OAuth-First)"
        USER[User Login]
        GOOGLE_OAUTH[Google OAuth 2.0]
        USER_CREDS[User's OAuth Credentials]
        JWT_TOKEN[JWT Access Token]
    end
    
    subgraph "Google Cloud API Authentication"
        subgraph "Priority 1: User OAuth (Production)"
            USER_TOKEN[User OAuth Token]
            USER_SCOPES[OAuth Scopes]
            DIALOGFLOW_API[Dialogflow CX API]
            GEMINI_API[Generative Language API]
        end
        
        subgraph "Priority 2: API Key (Development)"
            DEV_API_KEY[GOOGLE_API_KEY]
            DEV_GEMINI[Gemini API Development]
        end
        
        subgraph "Priority 3: ADC (Automatic Fallback)"
            ADC[Application Default Credentials]
            GCP_SERVICE_ACCOUNT[Cloud Run Service Account]
            GCLOUD_AUTH[gcloud auth application-default]
        end
    end
    
    subgraph "Required OAuth Scopes"
        SCOPE_EMAIL[userinfo.email]
        SCOPE_PROFILE[userinfo.profile]
        SCOPE_GCP[cloud-platform.read-only]
        SCOPE_DIALOGFLOW[dialogflow]
        SCOPE_GEMINI[generative-language.retriever]
    end
    
    USER --> GOOGLE_OAUTH
    GOOGLE_OAUTH --> USER_CREDS
    USER_CREDS --> JWT_TOKEN
    JWT_TOKEN --> USER_TOKEN
    
    USER_TOKEN --> USER_SCOPES
    USER_SCOPES --> SCOPE_EMAIL
    USER_SCOPES --> SCOPE_PROFILE
    USER_SCOPES --> SCOPE_GCP
    USER_SCOPES --> SCOPE_DIALOGFLOW
    USER_SCOPES --> SCOPE_GEMINI
    
    USER_TOKEN --> DIALOGFLOW_API
    USER_TOKEN --> GEMINI_API
    
    DEV_API_KEY --> DEV_GEMINI
    
    ADC --> GCP_SERVICE_ACCOUNT
    ADC --> GCLOUD_AUTH
    GCP_SERVICE_ACCOUNT --> DIALOGFLOW_API
    GCLOUD_AUTH --> DIALOGFLOW_API
    
    style USER_TOKEN fill:#4caf50
    style USER_CREDS fill:#8bc34a
    style DEV_API_KEY fill:#ffeb3b
    style ADC fill:#2196f3
    style REMOVED_1 fill:#ffcdd2
    style REMOVED_2 fill:#ffcdd2
    style REMOVED_3 fill:#ffcdd2
```

### Authentication Priority Flow

**LLM Judge Service Authentication**:
1. **User OAuth (Preferred)**: Uses logged-in user's OAuth credentials
   - Scopes: `generative-language.retriever`, `dialogflow`
   - Respects user's GCP permissions
   - No API key needed
   
2. **API Key (Development)**: `GOOGLE_API_KEY` environment variable
   - Used when OAuth unavailable
   - Good for local testing
   - Limited to configured project
   
3. **ADC (Automatic)**: Application Default Credentials
   - Cloud Run: Service account automatically injected
   - Local: `gcloud auth application-default login`
   - No configuration needed

**Key Improvements**:
- ✅ **No hardcoded models**: Models discovered via Google Generative AI API
- ✅ **No service account files**: OAuth provides user-specific credentials  
- ✅ **Automatic ADC**: Works in GCP without environment variables
- ✅ **User-scoped access**: Users see only agents they have permission to access

## Environment Configuration

```mermaid
graph TB
    subgraph "Configuration Management"
        subgraph "Environment Files"
            ENV_EXAMPLE[.env.example]
            ENV_LOCAL[.env.local]
            ENV_STAGING[.env.staging]
            ENV_PROD[.env.production]
        end
        
        subgraph "OAuth Configuration"
            OAUTH_CLIENT_ID[Google OAuth Client ID]
            OAUTH_CLIENT_SECRET[Google OAuth Client Secret]
            OAUTH_REDIRECT[OAuth Redirect URI]
        end
        
        subgraph "Docker Configuration"
            COMPOSE_DEV[docker-compose.yml]
            COMPOSE_STAGING[docker-compose.staging.yml]
            COMPOSE_PROD[docker-compose.prod.yml]
        end
    end
    
    subgraph "Environment Variables"
        subgraph "Frontend Config"
            VITE_API_URL[VITE_API_URL]
            VITE_APP_NAME[VITE_APP_NAME]
            VITE_ENV[VITE_ENVIRONMENT]
        end
        
        subgraph "Backend Config"
            DB_URL[DATABASE_URL]
            JWT_SECRET[JWT_SECRET_KEY]
            GOOGLE_CLIENT_ID[GOOGLE_CLIENT_ID]
            GOOGLE_CLIENT_SECRET[GOOGLE_CLIENT_SECRET]
            GOOGLE_API_KEY[GOOGLE_API_KEY - Optional for Dev]
            API_HOST[API_HOST]
            API_PORT[API_PORT]
        end
        
        subgraph "Authentication Methods"
            USER_OAUTH[User OAuth Tokens]
            API_KEY_AUTH[API Key - Development]
            ADC_AUTH[ADC - Auto-detected in GCP]
        end
    end
    
    subgraph "Security Considerations"
        SECRETS_MGMT[Secrets Management]
        ENV_ISOLATION[Environment Isolation]
        OAUTH_MGMT[OAuth Token Management]
        ACCESS_CONTROL[Access Control]
    end
    
    ENV_LOCAL --> VITE_API_URL
    ENV_LOCAL --> DB_URL
    ENV_LOCAL --> GOOGLE_CLIENT_ID
    ENV_LOCAL --> GOOGLE_CLIENT_SECRET
    
    OAUTH_CLIENT_ID --> USER_OAUTH
    OAUTH_CLIENT_SECRET --> USER_OAUTH
    
    GOOGLE_API_KEY --> API_KEY_AUTH
    
    COMPOSE_DEV --> ENV_LOCAL
    
    SECRETS_MGMT --> OAUTH_CLIENT_ID
    SECRETS_MGMT --> OAUTH_CLIENT_SECRET
    ENV_ISOLATION --> ENV_LOCAL
    OAUTH_MGMT --> USER_OAUTH
    ACCESS_CONTROL --> SECRETS_MGMT
    
    style USER_OAUTH fill:#4caf50
    style OAUTH_MGMT fill:#8bc34a
    style SECRETS_MGMT fill:#fff3e0
    style ENV_ISOLATION fill:#e8f5e8
    style API_KEY_AUTH fill:#ffeb3b
    style ADC_AUTH fill:#2196f3
```

## API Configuration and Docker Networking

### Critical Configuration Patterns

**API Service Configuration** (`frontend/src/services/api.ts`):
```typescript
// ✅ CORRECT: Docker environment configuration
const api = axios.create({
  baseURL: '',  // Empty for relative URLs in Docker
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ✅ CORRECT: API endpoints with proper trailing slashes
const endpoints = {
  // Collection endpoints MUST have trailing slash for FastAPI
  datasets: '/api/v1/datasets/',      // ✅ Correct
  testRuns: '/api/v1/test-runs/',     // ✅ Correct
  
  // Individual resource endpoints without trailing slash
  dataset: (id: number) => `/api/v1/datasets/${id}`,     // ✅ Correct
  testRun: (id: number) => `/api/v1/test-runs/${id}`,    // ✅ Correct
};

// ❌ INCORRECT: Hardcoded localhost URLs
baseURL: 'http://localhost:8000',  // ❌ Wrong for Docker

// ❌ INCORRECT: Missing trailing slashes on collection endpoints
datasets: '/api/v1/datasets',      // ❌ Causes 307 redirects
testRuns: '/api/v1/test-runs',      // ❌ Causes 307 redirects
```

### Docker Port Mapping Architecture

```mermaid
graph TB
    subgraph "Host System (Windows)"
        HOST_3000[localhost:3000]
        HOST_8000[localhost:8000]
    end
    
    subgraph "Docker Compose Network"
        subgraph "Frontend Container"
            FE_NGINX[Nginx Server:80]
            FE_STATIC[React Static Files]
            FE_PROXY[API Proxy to Backend]
        end
        
        subgraph "Backend Container"  
            BE_FASTAPI[FastAPI Server:8000]
            BE_ROUTES[API Routes /api/v1/*]
        end
    end
    
    subgraph "Internal Container Communication"
        INT_API[http://backend:8000/api/v1/]
        INT_ROUTING[Container-to-Container DNS]
    end
    
    HOST_3000 -.->|Port Mapping| FE_NGINX
    HOST_8000 -.->|Port Mapping| BE_FASTAPI
    
    FE_NGINX --> FE_STATIC
    FE_NGINX --> FE_PROXY
    FE_PROXY -.->|Internal Network| INT_API
    INT_API --> BE_FASTAPI
    BE_FASTAPI --> BE_ROUTES
    
    style HOST_3000 fill:#e3f2fd
    style HOST_8000 fill:#f3e5f5
    style INT_API fill:#e8f5e8
    style BE_ROUTES fill:#fff3e0
```

### Nginx Proxy Configuration

**Frontend Container** (`frontend/nginx.conf`):
```nginx
# Proxy API requests to backend container
location /api/ {
    proxy_pass http://backend:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Serve React static files
location / {
    try_files $uri $uri/ /index.html;
}
```

### FastAPI Trailing Slash Requirements

**Critical Rule**: FastAPI collection endpoints require trailing slashes to avoid 307 redirects.

| Endpoint Type | Correct Format | Result |
|---------------|----------------|---------|
| Collection (List/Create) | `/api/v1/datasets/` | ✅ Direct 200 response |
| Collection (List/Create) | `/api/v1/datasets` | ❌ 307 redirect → slower |
| Individual Resource | `/api/v1/datasets/123` | ✅ Direct 200 response |
| Individual Resource | `/api/v1/datasets/123/` | ✅ Also works |

### Debugging Docker API Issues

**Check Container Connectivity**:
```bash
# Verify containers are running
docker-compose ps

# Check frontend container logs
docker-compose logs frontend

# Check backend container logs  
docker-compose logs backend

# Test internal API connectivity from frontend container
docker-compose exec frontend curl http://backend:8000/api/v1/datasets/

# Test external API access from host
curl http://localhost:8000/api/v1/datasets/
```

**Common Configuration Issues**:

1. **Wrong baseURL in api.ts**:
   - ❌ `baseURL: 'http://localhost:8000'` (hardcoded)
   - ✅ `baseURL: ''` (relative URLs)

2. **Missing trailing slashes**:
   - ❌ `/api/v1/datasets` → 307 redirect
   - ✅ `/api/v1/datasets/` → 200 direct

3. **Nginx proxy misconfiguration**:
   - Verify `proxy_pass http://backend:8000` points to correct container
   - Check Docker Compose service names match

4. **Container networking issues**:
   - Ensure both services are on same Docker network
   - Verify service names in docker-compose.yml

### Development vs Production Configuration

| Environment | Frontend Access | Backend Access | API BaseURL |
|-------------|----------------|----------------|-------------|
| **Development** | localhost:3000 | localhost:8000 | `''` (relative) |
| **Docker Local** | localhost:3000 | localhost:8000 | `''` (relative) |
| **Production** | domain.com | domain.com/api | `''` (relative) |

**Key Principle**: Always use relative URLs (`baseURL: ''`) so the frontend automatically adapts to its hosting environment.

## Monitoring and Observability

```mermaid
graph TB
    subgraph "Application Monitoring"
        subgraph "Frontend Monitoring"
            FE_ERRORS[Error Tracking]
            FE_PERFORMANCE[Performance Metrics]
            FE_ANALYTICS[User Analytics]
        end
        
        subgraph "Backend Monitoring"
            BE_LOGS[Application Logs]
            BE_METRICS[API Metrics]
            BE_HEALTH[Health Checks]
        end
        
        subgraph "Infrastructure Monitoring"
            DOCKER_STATS[Container Statistics]
            RESOURCE_USAGE[Resource Usage]
            NETWORK_METRICS[Network Metrics]
        end
    end
    
    subgraph "External Service Monitoring"
        DIALOGFLOW_STATUS[Dialogflow API Status]
        AI_SERVICE_STATUS[AI Service Status]
        DB_PERFORMANCE[Database Performance]
    end
    
    subgraph "Alerting and Notifications"
        ERROR_ALERTS[Error Alerts]
        PERFORMANCE_ALERTS[Performance Alerts]
        UPTIME_ALERTS[Uptime Alerts]
        NOTIFICATION_CHANNELS[Notification Channels]
    end
    
    FE_ERRORS --> ERROR_ALERTS
    BE_LOGS --> ERROR_ALERTS
    BE_METRICS --> PERFORMANCE_ALERTS
    DOCKER_STATS --> UPTIME_ALERTS
    
    DIALOGFLOW_STATUS --> UPTIME_ALERTS
    AI_SERVICE_STATUS --> UPTIME_ALERTS
    
    ERROR_ALERTS --> NOTIFICATION_CHANNELS
    PERFORMANCE_ALERTS --> NOTIFICATION_CHANNELS
    UPTIME_ALERTS --> NOTIFICATION_CHANNELS
    
    style FE_ERRORS fill:#ffebee
    style BE_LOGS fill:#e3f2fd
    style ERROR_ALERTS fill:#fff3e0
```