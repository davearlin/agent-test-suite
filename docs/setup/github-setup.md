# GitHub Repository Setup Guide

## 📦 **Initial Repository Setup**

### **1. Initialize Git Repository**
```bash
cd "C:\Projects\your-workspace\Dialogflow Agent Tester"
git init
git add .
git commit -m "Initial commit: Dialogflow Test Suite with direct routing"
```

### **2. Connect to GitHub**
```bash
git remote add origin https://github.com/your-org/dialogflow-test-suite.git
git branch -M main
git push -u origin main
```

### **3. Repository Settings**
- **Name**: `dialogflow-test-suite`
- **Description**: `Comprehensive platform for testing Dialogflow CX agents with dataset management, automated testing, and detailed analytics`
- **Topics**: `dialogflow`, `conversational-ai`, `chatbot-testing`, `test-automation`, `react`, `fastapi`, `docker`, `typescript`

## 🔒 **Security Checklist**

### **Files Already Protected by .gitignore:**
- ✅ `service-account.json` (sensitive Google Cloud credentials)
- ✅ `node_modules/` (dependencies)
- ✅ `__pycache__/` (Python cache)
- ✅ `.env` files (environment variables)

### **Public Repository Safe:**
- ✅ `service-account.json.example` (template file - safe to share)
- ✅ All source code (no hardcoded secrets)
- ✅ Docker configuration (standard setup)

## 📝 **Post-Upload Tasks**

1. **Update README.md** - Replace `YOUR_USERNAME` with actual GitHub username
2. **Create Issues** - Document any future enhancements
3. **Add License** - Consider MIT or Apache 2.0
4. **Create Releases** - Tag stable versions

## 🚀 **Collaboration Setup**

### **For Future Developers:**
```bash
git clone https://github.com/your-org/dialogflow-test-suite.git
cd dialogflow-test-suite
cp service-account.json.example service-account.json
# Configure service-account.json with your Google Cloud credentials
docker-compose up -d
```

### **Development Workflow:**
1. Create feature branches: `git checkout -b feature/new-feature`
2. Make changes and test locally
3. Commit and push: `git push origin feature/new-feature`
4. Create Pull Request for review

## 🏗️ **Infrastructure Management**

### **GitHub Actions Secrets Required:**
For automated deployments, configure these repository secrets:

```
GOOGLE_OAUTH_CLIENT_ID          # OAuth client ID for Google authentication
GOOGLE_OAUTH_CLIENT_SECRET      # OAuth client secret
JWT_SECRET_KEY                  # JWT signing secret
GOOGLE_SERVICE_ACCOUNT_KEY      # Service account key for Terraform/GCP access
```

### **Automated CI/CD Pipeline:**
- **Test Job**: Runs on every push to `main` and pull requests
  - Backend: 11 unit tests (pytest) - CSV utils, mocking, validation
  - Frontend: Vitest tests - component and utility testing
  - Quality Gate: All tests must pass before deployment
- **Build Job**: Runs after tests pass (main branch only)
  - Infrastructure: Terraform automatically manages all GCP resources  
  - Backend: Docker build and deploy to Cloud Run
  - Frontend: Vite build and deploy to Firebase
  - OAuth: Environment variables automatically injected via GitHub Actions
- **Smart Triggers**: Skips builds for documentation-only changes (*.md, docs/, design/)

### **Terraform State Management:**
- All GCP resources are managed as Infrastructure as Code
- Existing resources imported to prevent 409 conflicts
- OAuth secrets managed via TF_VAR environment variables
- See `docs/setup/terraform-infrastructure.md` for details
