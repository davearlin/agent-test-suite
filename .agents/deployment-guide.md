# Dialogflow Test Suite - Deployment and Development Guide ✅ PRODUCTION READY

**Repository**: [dialogflow-test-suite](https://github.com/your-org/dialogflow-test-suite)

## 🚀 **Production Infrastructure - DEPLOYED**

### **Live Infrastructure Components**
```yaml
PostgreSQL Database:
  Instance: dialogflow-tester-postgres-dev
  Status: RUNNABLE
  Public IP: 35.202.15.119
  Database: dialogflow_tester_dev
  User: app_user_dev
  Password: Auto-generated (16-char secure)
  Backups: Daily at 3:00 AM

Redis Cache:  
  Instance: dialogflow-tester-redis-dev
  Memory: 1GB Basic tier
  Version: Redis 7.0
  Status: OPERATIONAL

VPC Network:
  Network: dialogflow-tester-vpc
  Subnet: 10.0.0.0/24 (us-central1)
  Connector: df-tester-connector

Security:
  Authentication: Workload Identity Federation
  - **🚀 GCP Project**: `your-gcp-project-id`
  GitHub Secrets: ✅ Configured
```

### **Ready for Application Deployment**
Infrastructure is deployed and operational. Next push to `main` branch will:
1. Build Docker images for frontend/backend
2. Deploy Cloud Run services  
3. Make application available at production URLs

## 🏠 **Local Development Setup**

### **Prerequisites**
- Docker Desktop installed and running
- PowerShell or Command Prompt
- Git for version control
- 8GB+ RAM recommended

### **Google Cloud Authentication Setup**

#### **Required for Production Use**
The application uses user-based authentication via Google OAuth. Each user must have:

1. **Google Cloud Platform Access**
   - Valid Google account with GCP project access
   - Dialogflow CX API enabled in target projects
   - Cloud Resource Manager API enabled for project listing

2. **IAM Permissions Required**
   ```
   roles/dialogflow.reader          # To list agents and flows
   roles/dialogflow.client          # To send queries to agents  
   roles/resourcemanager.viewer     # To list accessible projects
   ```

3. **OAuth Application Setup** (See `GOOGLE_OAUTH_SETUP.md` for detailed steps)
   - Google OAuth 2.0 client ID configured
   - Authorized redirect URIs: `http://localhost:3000/auth/callback`
   - Required scopes: 
     - `https://www.googleapis.com/auth/cloud-platform`
     - `https://www.googleapis.com/auth/dialogflow`

#### **Local Development Notes**
- Each user's Google credentials are used for API calls (no shared service account)
- Users only see Dialogflow agents they have IAM permissions for
- Regional endpoints are automatically configured (us-central1)

#### **🚨 Critical Frontend Development Patterns**
**For Production Reliability:**
- ✅ **Use Redux Collection Loading**: `dispatch(fetchTestRuns())` then filter in memory
- ❌ **Avoid Direct Single-Item APIs**: Can fail with axios baseURL issues in Docker
- 📚 **Reference**: `design/routing-architecture.md` for complete implementation patterns
- 🔧 **Pattern**: Detail pages load parent collections to prevent production routing failures

### **Quick Start Commands**

#### **Start the Application**
```powershell
# Navigate to project directory
cd "C:\Projects\Dialogflow Agent Tester"

# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

#### **Stop the Application**
```powershell
docker-compose down
```

#### **View Logs**
```powershell
# All services
docker-compose logs

# Specific service
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres
docker-compose logs redis
```

#### **Rebuild After Code Changes**
```powershell
# ⚠️ IMPORTANT: Backend requires rebuild, not just restart
# Code changes to backend won't take effect with just restart!

# Rebuild backend after code changes
docker-compose build backend
docker-compose up -d backend

# Rebuild frontend after code changes  
docker-compose build frontend
docker-compose up -d frontend

# Rebuild all services
docker-compose build
docker-compose up -d

# Quick restart (only for config changes)
docker-compose restart backend
```

### **Application Access**

#### **Main Application URLs**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Database**: localhost:5432 (internal)
- **Redis**: localhost:6379 (internal)

#### **Direct Route Access**
- **Dashboard**: http://localhost:3000/
- **Dataset List**: http://localhost:3000/datasets
- **Edit Dataset**: http://localhost:3000/datasets/{id}/edit
- **Manage Questions**: http://localhost:3000/datasets/{id}/questions
- **Test Runs**: http://localhost:3000/test-runs
- **Test Run Details**: http://localhost:3000/test-runs/{id}

#### **Default Authentication (User-Based OAuth)**
- **Method**: OAuth via Google Sign-In (Individual User Credentials)
- **Access**: Landing page at http://localhost:3000
- **Requirements**: 
  - Google Cloud Platform account with appropriate IAM permissions
  - Dialogflow CX API access for target projects
  - Resource Manager API access for project listing
- **Security Model**: Each user's Google OAuth token used for API calls (no shared service account)
- **Permissions**: Users only see agents they have IAM access to

#### **Testing URLs**

##### **Public Endpoints (No Authentication Required)**
```bash
# Test backend health
curl http://localhost:8000/health

# Test API documentation
curl http://localhost:8000/docs
```

##### **Authentication Required Endpoints**

**Step 1: Get Authentication Token**
```bash
# OAuth Login (Recommended)
# 1. Visit http://localhost:3000
# 2. Click "Sign In with Google" 
# 3. Grant Google Cloud + Dialogflow permissions
# 4. Extract token from browser network tab or localStorage
```

**Step 2: Test Protected Endpoints**
```bash
# Replace YOUR_TOKEN_HERE with actual JWT token
TOKEN="YOUR_TOKEN_HERE"

# Test dataset endpoint
curl http://localhost:8000/api/v1/datasets \
  -H "Authorization: Bearer $TOKEN"

# Test Dialogflow agents (user-specific)
curl http://localhost:8000/api/v1/dialogflow/agents \
  -H "Authorization: Bearer $TOKEN"

# Test test runs
curl http://localhost:8000/api/v1/test-runs \
  -H "Authorization: Bearer $TOKEN"
```

##### **Important Notes**
- ⚠️ **All API routes now require authentication** (except /health and /docs)
- 🔐 **Dialogflow agents are user-specific** - different users see different agents
- 🚫 **Unauthenticated requests return 401 Unauthorized**
- 📝 **Admin fallback is for development only** - use Google OAuth in production

## 🔧 **Development Workflow**

### **Backend Development (FastAPI)**

#### **File Structure**
```
backend/
├── app/
│   ├── api/
│   │   ├── auth.py          # Authentication endpoints
│   │   ├── datasets.py      # Dataset management
│   │   ├── questions.py     # Question management  
│   │   ├── test_runs.py     # Test execution
│   │   ├── results.py       # Results viewing
│   │   └── health.py        # Health checks
│   ├── core/
│   │   ├── config.py        # Configuration settings
│   │   ├── database.py      # Database connection
│   │   └── security.py      # Authentication logic
│   ├── models/
│   │   ├── database.py      # SQLAlchemy models
│   │   └── schemas.py       # Pydantic schemas
│   ├── services/
│   │   ├── dialogflow_service.py  # Dialogflow integration (STUBBED)
│   │   └── llm_service.py         # LLM evaluation service
│   └── main.py              # FastAPI application
├── Dockerfile               # Backend container definition
└── requirements.txt         # Python dependencies
```

#### **Making Backend Changes**
1. Edit Python files in `backend/app/`
2. Rebuild and restart backend container:
   ```powershell
   docker-compose build backend
   docker-compose up -d backend
   ```
3. Check logs for errors:
   ```powershell
   docker-compose logs backend
   ```

#### **Adding New Dependencies**
1. Add package to `backend/requirements.txt`
2. Rebuild backend container:
   ```powershell
   docker-compose build backend
   docker-compose up -d backend
   ```

### **Frontend Development (React)**

#### **File Structure**
```
frontend/
├── src/
│   ├── components/
│   │   ├── Layout.tsx       # Main layout with navigation
│   │   └── PrivateRoute.tsx # Protected route wrapper
│   ├── pages/
│   │   ├── Login.tsx        # Login page
│   │   ├── Register.tsx     # Registration page
│   │   ├── Dashboard.tsx    # Main dashboard
│   │   ├── Datasets.tsx     # Dataset management
│   │   ├── TestRuns.tsx     # Test execution
│   │   └── Results.tsx      # Results viewing
│   ├── store/
│   │   ├── store.ts         # Redux store configuration
│   │   ├── authSlice.ts     # Authentication state
│   │   └── dataSlice.ts     # Application data state
│   ├── App.tsx              # Main React application
│   └── index.tsx            # React entry point
├── Dockerfile               # Frontend container definition
└── package.json             # Node.js dependencies
```

#### **Making Frontend Changes**
1. Edit TypeScript/React files in `frontend/src/`
2. Rebuild and restart frontend container:
   ```powershell
   docker-compose build frontend
   docker-compose up -d frontend
   ```
3. Check logs for build errors:
   ```powershell
   docker-compose logs frontend
   ```

#### **Adding New Dependencies**
1. Add package to `frontend/package.json` or use npm install
2. Rebuild frontend container:
   ```powershell
   docker-compose build frontend
   docker-compose up -d frontend
   ```

## 🗄️ **Database Management**

### **Accessing PostgreSQL**
```powershell
# Connect to database container
docker exec -it agent-evaluator-db psql -U postgres -d agent_evaluator

# Common PostgreSQL commands
\l              # List databases
\c database     # Connect to database
\dt             # List tables
\d table_name   # Describe table structure
\q              # Quit
```

### **Database Schema**
```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    hashed_password VARCHAR NOT NULL,
    full_name VARCHAR,
    role VARCHAR DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Datasets table  
CREATE TABLE datasets (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT,
    file_path VARCHAR,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Questions table
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER REFERENCES datasets(id),
    text TEXT NOT NULL,
    expected_intent VARCHAR,
    expected_entities JSONB,
    question_metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Test Runs table
CREATE TABLE test_runs (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    dataset_id INTEGER REFERENCES datasets(id),
    dialogflow_agent_id VARCHAR,
    created_by INTEGER REFERENCES users(id),
    status VARCHAR DEFAULT 'pending',
    total_questions INTEGER DEFAULT 0,
    completed_questions INTEGER DEFAULT 0,
    accuracy_score FLOAT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Test Results table
CREATE TABLE test_results (
    id SERIAL PRIMARY KEY,
    test_run_id INTEGER REFERENCES test_runs(id),
    question_id INTEGER REFERENCES questions(id),
    user_input TEXT NOT NULL,
    expected_intent VARCHAR,
    actual_intent VARCHAR,
    expected_entities JSONB,
    actual_entities JSONB,
    confidence_score FLOAT,
    is_correct BOOLEAN,
    llm_evaluation JSONB,
    response_time FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔄 **Service Integration**

### **Dialogflow CX Integration**

#### **Current Status**: ✅ USER-BASED AUTHENTICATION READY
The Dialogflow service now uses user-specific Google OAuth tokens for authentication:

1. **User Authentication Setup**
   - Users sign in with Google OAuth
   - App requests Google Cloud Platform + Dialogflow API permissions
   - Each user sees only agents they have IAM access to

2. **Required User Permissions**
   Users need these IAM roles in your GCP project:
   - `Dialogflow API Client` - Basic API access
   - `Dialogflow CX Developer` - Agent management
   - `Project Viewer` - Project metadata

3. **Environment Configuration**
   ```yaml
   environment:
     - GOOGLE_CLOUD_PROJECT=your-actual-gcp-project-id
     - GOOGLE_CLIENT_ID=your-oauth-client-id
     - GOOGLE_CLIENT_SECRET=your-oauth-client-secret
   ```

4. **Authentication Flow**
   - ✅ **User-specific**: Each user's Google credentials used for API calls
   - ✅ **Permission-aware**: Users see only agents they can access
   - ✅ **Auto-refresh**: Tokens automatically renewed
   - ✅ **Fallback**: Service account available as backup

#### **Dialogflow Agent Configuration**
- **Access Control**: Based on user's IAM permissions in GCP project
- **Format**: Agent ID format: `projects/PROJECT_ID/locations/LOCATION/agents/AGENT_ID`
- **Testing**: Users can test only agents they have access to
- **Security**: No shared credentials - each user uses their own Google account

### **LLM Evaluation Service**

## 🌐 **GCP Deployment Guide**

### **Prerequisites**
1. GCP Project with billing enabled
2. Required APIs enabled:
   - Cloud Run API
   - Cloud SQL API
   - Cloud Storage API
   - Dialogflow CX API
   - Generative AI API

### **Infrastructure Setup**

#### **Cloud SQL (PostgreSQL)**
```bash
# Create Cloud SQL instance
gcloud sql instances create dialogflow-tester-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=us-central1

# Create database
gcloud sql databases create agent_evaluator \
    --instance=dialogflow-tester-db

# Create user
gcloud sql users create appuser \
    --instance=dialogflow-tester-db \
    --password=secure-password
```

#### **Cloud Storage**
```bash
# Create bucket for file uploads
gsutil mb gs://your-project-id-uploads

# Set bucket permissions
gsutil iam ch serviceAccount:your-service-account@your-project.iam.gserviceaccount.com:objectAdmin gs://your-project-id-uploads
```

#### **Cloud Run (Backend)**
```bash
# Build and push backend image
docker build -t gcr.io/your-project-id/dialogflow-tester-backend ./backend
docker push gcr.io/your-project-id/dialogflow-tester-backend

# Deploy to Cloud Run
gcloud run deploy dialogflow-tester-backend \
    --image=gcr.io/your-project-id/dialogflow-tester-backend \
    --platform=managed \
    --region=us-central1 \
    --allow-unauthenticated \
    --port=8000 \
    --set-env-vars="POSTGRES_SERVER=db-connection-string,SECRET_KEY=production-secret"
```

#### **Cloud Run (Frontend)**
```bash
# Build and push frontend image
docker build -t gcr.io/your-project-id/dialogflow-tester-frontend ./frontend
docker push gcr.io/your-project-id/dialogflow-tester-frontend

# Deploy to Cloud Run
gcloud run deploy dialogflow-tester-frontend \
    --image=gcr.io/your-project-id/dialogflow-tester-frontend \
    --platform=managed \
    --region=us-central1 \
    --allow-unauthenticated \
    --port=80
```

### **Environment Configuration**

#### **Production Environment Variables**
```yaml
# Backend
POSTGRES_SERVER: /cloudsql/your-project:us-central1:dialogflow-tester-db
POSTGRES_USER: appuser
POSTGRES_PASSWORD: secure-password
POSTGRES_DB: agent_evaluator
SECRET_KEY: production-jwt-secret-key
GOOGLE_CLOUD_PROJECT: your-project-id

# Frontend
REACT_APP_API_URL: https://dialogflow-tester-backend-xyz-uc.a.run.app
```

### **CI/CD Pipeline Setup**

#### **GitHub Actions Example**
```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Cloud SDK
        uses: google-github-actions/setup-gcloud@v0
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: ${{ secrets.GCP_PROJECT }}
          
      - name: Configure Docker
        run: gcloud auth configure-docker
        
      - name: Build and Push Backend
        run: |
          docker build -t gcr.io/${{ secrets.GCP_PROJECT }}/backend ./backend
          docker push gcr.io/${{ secrets.GCP_PROJECT }}/backend
          
      - name: Deploy Backend
        run: |
          gcloud run deploy backend \
            --image=gcr.io/${{ secrets.GCP_PROJECT }}/backend \
            --region=us-central1 \
            --platform=managed
```

## 🐛 **Troubleshooting Guide**

### **Common Issues**

#### **Authentication Issues**

**"Authentication required" errors when testing API**
1. Most endpoints now require authentication:

### **Application Features Overview**

The Dialogflow Test Suite provides comprehensive testing capabilities with the following key features:

#### **Webhook Control System (Oct 2025)**
- **Quick Test Page**: Material-UI switch to enable/disable webhooks per test
- **Test Runs**: Per-test run webhook configuration with default enabled state
- **Default Behavior**: Webhooks enabled by default to maintain existing functionality
- **API Integration**: QueryParameters.disable_webhook properly passed to Dialogflow CX
- **Database Storage**: Webhook preferences stored in test_runs table for analysis

#### **Authentication & Security**
- **Google OAuth Integration**: Individual user authentication with proper IAM respect
- **User-Specific Access**: Each user sees only agents they have permissions for
- **Role-Based Security**: JWT tokens with role management and secure API access
- **Project Filtering**: Users access only Google Cloud projects they have access to

#### **Testing Capabilities**
- **Quick Test**: Single query testing with immediate results and webhook control
- **Batch Test Runs**: Execute comprehensive test suites against multiple datasets
- **Multi-Parameter Evaluation**: AI-powered evaluation with configurable parameters and weights
- **Results Analysis**: Detailed test outcomes with CSV export and parameter breakdown

### **Direct Route Access**
- **Dataset Management**: http://localhost:3000/datasets
- **Edit Dataset**: http://localhost:3000/datasets/1/edit
- **Manage Questions**: http://localhost:3000/datasets/1/questions
- **Test Runs**: http://localhost:3000/test-runs
- **Test Run Details**: http://localhost:3000/test-runs/{id}
- **Quick Test**: http://localhost:3000/quick-test (includes webhook toggle)

**"Please authenticate with Google Cloud" in Quick Test**
1. **Re-authenticate with expanded permissions**:
   - Click "Sign In Again" button in the app
   - Grant Google Cloud Platform + Dialogflow API permissions
   - Refresh the page

2. **Check user IAM permissions**:
   - Verify user has `Dialogflow API Client` role
   - Verify user has `Dialogflow CX Developer` role
   - Contact Google Cloud admin if needed

**Token refresh issues**
1. Sign out and back in to get fresh tokens
2. Check backend logs for token refresh errors:
   ```powershell
   docker-compose logs backend | Select-String "token"
   ```

#### **Container Won't Start**
1. Check logs:
   ```powershell
   docker-compose logs [service-name]
   ```
2. Verify Docker Desktop is running
3. Check port conflicts (3000, 8000, 5432, 6379)
4. Restart Docker Desktop

#### **Database Connection Issues**
1. Verify PostgreSQL container is healthy:
   ```powershell
   docker-compose ps
   ```
2. Check database logs:
   ```powershell
   docker-compose logs postgres
   ```
3. Reset database:
   ```powershell
   docker-compose down -v
   docker-compose up -d
   ```

#### **Frontend Build Failures**
1. Check TypeScript errors:
   ```powershell
   docker-compose logs frontend
   ```
2. Clear node_modules and rebuild:
   ```powershell
   docker-compose build --no-cache frontend
   ```

#### **Backend Import Errors**
1. Check Python dependencies:
   ```powershell
   docker-compose logs backend
   ```
2. Verify requirements.txt and rebuild:
   ```powershell
   docker-compose build --no-cache backend
   ```

### **Performance Optimization**

#### **Development**
- Use `docker-compose up -d` to run in background
- Monitor resource usage with `docker stats`
- Use `.dockerignore` to exclude unnecessary files

#### **Production**
- Enable PostgreSQL connection pooling
- Configure Redis for session storage
- Use Cloud CDN for static assets
- Implement proper logging and monitoring

## 🔒 **Security Considerations**

### **Development**
- Default credentials are for development only
- Database data persists in Docker volumes
- No SSL/TLS in local development

### **Production**
- Use strong, unique passwords
- Enable SSL/TLS certificates
- Configure proper CORS origins
- Use Cloud IAM for service authentication
- Enable Cloud SQL SSL connections
- Implement rate limiting
- Use Cloud Security Command Center for monitoring

## 📊 **Monitoring and Logging**

### **Local Development**
```powershell
# View real-time logs
docker-compose logs -f

# Check container health
docker-compose ps

# Monitor resource usage
docker stats
```

### **Production (GCP)**
- Cloud Logging for application logs
- Cloud Monitoring for metrics and alerts
- Cloud Trace for request tracing
- Error Reporting for exception tracking

## 🚀 **Production Deployment to Google Cloud Platform**

### **Overview**
The Dialogflow Test Suite is production-ready with complete CI/CD pipeline using GitHub Actions, Workload Identity Federation, and Terraform Infrastructure as Code.

### **Architecture**
- **Compute**: Cloud Run (serverless containers)
- **Database**: Cloud SQL PostgreSQL (managed database)
- **Cache**: Memorystore Redis (managed Redis)
- **Networking**: VPC with private IP ranges
- **Security**: Workload Identity Federation (no service account keys)
- **CI/CD**: GitHub Actions with multi-environment support

### **Prerequisites for Production Deployment**

#### **GCP Administrator Requirements**
1. **Project Setup**
   - GCP project with billing enabled
   - Required APIs enabled (see `GCP_ADMIN_SETUP_GUIDE.md`)
   - IAM permissions: Project IAM Admin, Workload Identity Pool Admin

2. **Workload Identity Federation Setup**
   - Completed setup (see `WORKLOAD_IDENTITY_SETUP_COMPLETE.md`)
   - Service account with required IAM roles
   - GitHub repository authentication configured

#### **Developer Requirements**

**Google Cloud Access**
   - OAuth application configured (see `GOOGLE_OAUTH_SETUP.md`)
   - Dialogflow CX permissions in target projects

### **Deployment Options**

#### **Option 1: Automated GitHub Actions Deployment (Recommended)**

**Step 1: Configure Repository Secrets**
Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```
# Authentication (Required)
WIF_PROVIDER=projects/your-gcp-project-number/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider
WIF_SERVICE_ACCOUNT=github-actions-dialogflow@your-gcp-project-id.iam.gserviceaccount.com
GCP_PROJECT_ID_DEV=your-gcp-project-id

# Infrastructure (Added after Terraform deployment)
CLOUD_SQL_INSTANCE_CONNECTION_NAME_DEV=[from terraform output]
REDIS_HOST_DEV=[from terraform output]
DATABASE_URL_DEV=[from terraform output]
REDIS_URL_DEV=[from terraform output]
```

**Step 2: Deploy Infrastructure First (One-time)**
```bash
# Clone repository
git clone https://github.com/davearlin/dialogflow-test-suite.git
cd dialogflow-test-suite/terraform

# Configure for your environment
cp terraform.tfvars.dev.example terraform.tfvars.dev
# Edit terraform.tfvars.dev with your project details

# Deploy infrastructure
terraform init
terraform plan -var-file="terraform.tfvars.dev"
terraform apply -var-file="terraform.tfvars.dev"

# Note the outputs for GitHub secrets
terraform output
```

**Step 3: Trigger Deployment**
```bash
# Push to main branch triggers production deployment
git push origin main

# Push to develop branch triggers development deployment
git push origin develop
```

**Step 4: Monitor Deployment**
- Go to GitHub repository → Actions tab
- Monitor the "Deploy to GCP" workflow
- Check Cloud Run deployments in GCP Console

#### **Option 2: Manual Terraform Deployment**

**For Infrastructure Only (Advanced Users)**
```bash
cd terraform

# Development environment
terraform workspace select dev || terraform workspace new dev
terraform apply -var-file="terraform.tfvars.dev"

# Production environment
terraform workspace select prod || terraform workspace new prod
terraform apply -var-file="terraform.tfvars.prod"
```

### **Environment Configuration**

#### **GCP Development Environment**
- **Project**: Your sandbox GCP project
- **Resources**: Minimal allocation for <5 users
- **Cost**: ~$30-50/month
- **Scaling**: Manual scaling, lower limits

#### **Production Environment**
- **Project**: Your production GCP project
- **Resources**: Full allocation for production workloads
- **Cost**: Variable based on usage
- **Scaling**: Auto-scaling, higher limits

### **Post-Deployment Configuration**

#### **OAuth Setup for Production Domain**
1. Update Google OAuth application:
   - Add production domain redirect URIs
   - Update `GOOGLE_REDIRECT_URI` environment variable
   - Ensure HTTPS-only for production

2. Configure DNS and SSL:
   - Point custom domain to Cloud Run service
   - Configure SSL certificate
   - Update CORS settings

#### **Application Configuration**
Update environment variables in Cloud Run:
```bash
ENVIRONMENT=production
GOOGLE_CLIENT_ID=[your-oauth-client-id]
GOOGLE_CLIENT_SECRET=[your-oauth-client-secret]
GOOGLE_REDIRECT_URI=https://your-domain.com/api/v1/auth/google/callback
DATABASE_URL=[auto-configured-by-terraform]
REDIS_URL=[auto-configured-by-terraform]
```

### **Monitoring and Maintenance**

#### **Health Monitoring**
- **Application**: Automatic health checks in Cloud Run
- **Database**: Cloud SQL monitoring dashboard
- **Redis**: Memorystore monitoring
- **Logs**: Cloud Logging with structured logging

#### **Scaling Configuration**
```yaml
# Cloud Run scaling (automatic)
Min instances: 0 (development) / 1 (production)
Max instances: 10 (development) / 100 (production)
Max concurrent requests: 80 per instance
CPU allocation: 1 vCPU per instance
Memory allocation: 2Gi per instance
```

#### **Backup and Recovery**
- **Database**: Automatic daily backups (Cloud SQL)
- **Infrastructure**: Terraform state in Cloud Storage
- **Application**: Container images in Artifact Registry

### **Security Best Practices**

#### **Implemented Security Features**
✅ **No Service Account Keys**: Workload Identity Federation
✅ **VPC Security**: Private IP ranges and firewall rules
✅ **Database Security**: Private connections via Cloud SQL Proxy
✅ **Container Security**: Distroless base images
✅ **Access Control**: IAM-based authentication
✅ **Audit Logging**: Complete audit trail

#### **Additional Production Hardening**
- Enable VPC Service Controls
- Configure Cloud Armor for DDoS protection
- Implement Cloud Key Management Service (KMS)
- Set up Security Command Center monitoring
- Configure log-based metrics and alerting

### **Cost Optimization**

#### **Development Environment Costs**
- Cloud SQL (db-f1-micro): ~$7/month
- Memorystore Redis (1GB): ~$26/month
- Cloud Run: Pay-per-request (~$1-5/month for light usage)
- **Total**: ~$35-40/month

#### **Production Cost Management**
- Use committed use discounts for predictable workloads
- Configure auto-scaling to minimize idle resources
- Implement Cloud Monitoring alerts for cost thresholds
- Use preemptible instances where appropriate

### **Troubleshooting Production Issues**

#### **Common Deployment Issues**
1. **Authentication Failures**
   - Verify WIF configuration and repository secrets
   - Check service account IAM roles

2. **Resource Allocation**
   - Verify GCP quotas and limits
   - Check VPC IP range conflicts

3. **Application Errors**
   - Review Cloud Logging for application errors
   - Check Cloud Run deployment logs
   - Verify environment variable configuration

#### **Support Resources**
- **Deployment Guide**: `GCP_ADMIN_SETUP_GUIDE.md`
- **Authentication**: `WORKLOAD_IDENTITY_SETUP_COMPLETE.md`
- **OAuth Setup**: `GOOGLE_OAUTH_SETUP.md`
- **Architecture**: `design/deployment-devops.md`

---

**💡 TIP**: Always test changes locally before deploying to production. Use the provided Docker setup to ensure consistency across environments.
