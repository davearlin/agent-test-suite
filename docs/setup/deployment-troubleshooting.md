# Deployment Troubleshooting Guide

## 🚨 **Common Issues and Solutions**

### **Terraform 409 "Already Exists" Errors**

**Problem**: Resources already exist in GCP but not in Terraform state
```
Error: Error creating [resource]: googleapi: Error 409: already exists
```

**Solution**: Import existing resources into Terraform state
```bash
# Example: Import existing VPC network
terraform import google_compute_network.vpc_network projects/PROJECT_ID/global/networks/NETWORK_NAME

# Check terraform/main.tf for all required import blocks
terraform plan  # Should show no changes after importing
```

### **OAuth "Setup Required" After Deployment**

**Problem**: Frontend shows "setup required for OAuth" despite successful deployment

**Root Cause**: Browser caching or environment variable issues

**Solution Steps**:
1. **Hard refresh browser**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. **Clear browser cache** for the site completely
3. **Try incognito/private window** to bypass cache
4. **Verify backend**: Check `https://BACKEND_URL/api/v1/auth/status` returns `google_oauth_configured: true`

### **Frontend API Calls to Wrong Domain**

**Problem**: Frontend making API calls to its own domain instead of backend
```
https://your-frontend-url.web.app/api/v1/auth/status
```
**Should be**:
```
https://your-backend-url.run.app/api/v1/auth/status
```

**Root Cause**: Vite environment variable precedence - `.env.local` overriding production settings

**Solution**: GitHub Actions automatically handles this via .env.local renaming during builds
```yaml
# Rename .env.local to prevent localhost override during production build
- name: Handle environment variables for production build
  run: |
    if [ -f .env.local ]; then
      mv .env.local .env.local.backup
    fi
  working-directory: ./frontend
```

### **GitHub Actions Deployment Failures**

**Problem**: Pipeline fails during Terraform or Firebase deployment

**Common Causes & Solutions**:

1. **Missing GitHub Secrets**:
   ```
   Error: Required secret GOOGLE_OAUTH_CLIENT_ID not found
   ```
   - Verify all secrets are configured in repository settings
   - Check secret names match exactly (case-sensitive)

2. **Service Account Permissions**:
   ```
   Error: insufficient permissions for operation
   ```
   - Ensure service account has required IAM roles
   - Check Workload Identity Federation configuration

3. **Terraform State Lock**:
   ```
   Error: state lock could not be acquired
   ```
   - Another deployment may be running
   - Wait for completion or manually unlock if stuck

### **Database Connection Issues**

**Problem**: Backend cannot connect to Cloud SQL database

**Debugging Steps**:
1. **Check VPC Connector**: Ensure `df-tester-connector` is properly configured
2. **Verify Database**: Confirm `dialogflow-tester-postgres-dev` is running
3. **Connection String**: Check environment variables in Cloud Run service
4. **Network Security**: Verify VPC firewall rules allow connections

### **Environment Variable Debugging**

**Problem**: Configuration values not properly set in deployed application

**Verification Steps**:
1. **Cloud Run Environment Variables**: Check service configuration in GCP Console
2. **GitHub Actions Logs**: Review deployment logs for TF_VAR variable injection
3. **Terraform Output**: Verify variables are properly passed to resources
4. **Frontend Build**: Check that built JavaScript contains correct API endpoints

## 🛠️ **Diagnostic Commands**

### **Local Environment**
```bash
# Test local backend OAuth configuration
curl http://localhost:8000/api/v1/auth/status

# Check local frontend API configuration
cd frontend
grep -r "VITE_API_BASE_URL" .env*

# Verify local build uses correct backend URL
npm run build
grep -r "dialogflow-tester-backend-dev" dist/assets/
```

### **Production Environment**
```bash
# Test production backend directly
curl https://your-backend-url.run.app/api/v1/auth/status

# Check deployed frontend JavaScript for correct backend URL
curl https://your-frontend-url.web.app/assets/index-*.js | grep "your-backend-url"

# Verify Terraform state
cd terraform
terraform show | grep oauth
```

### **GitHub Actions**
```bash
# Check deployment logs
gh run list --workflow=deploy.yml
gh run view [RUN_ID] --log

# Verify repository secrets
gh secret list
```

## 📋 **Deployment Checklist**

Before deploying, ensure:

- [ ] All GitHub repository secrets are configured
- [ ] Terraform import blocks are present for existing resources
- [ ] Service account has required GCP IAM permissions
- [ ] .env.production file contains correct backend URL
- [ ] No .env.local file in repository root
- [ ] OAuth client ID and secret are properly configured in Google Cloud Console

After deploying, verify:

- [ ] GitHub Actions workflow completed successfully
- [ ] Backend API responds correctly to /health and /auth/status endpoints
- [ ] Frontend loads without console errors
- [ ] OAuth authentication flow works end-to-end
- [ ] Database connectivity is functional
- [ ] All environment variables are properly injected

## 🔍 **Monitoring and Logs**

### **Google Cloud Console**
- **Cloud Run Logs**: Monitor backend service logs for errors
- **Cloud SQL Insights**: Check database performance and connections
- **Error Reporting**: Review application-level errors
- **Cloud Monitoring**: Set up alerts for service availability

### **Firebase Console**
- **Hosting**: Verify frontend deployment status and traffic
- **Performance Monitoring**: Track frontend load times
- **Analytics**: Monitor user engagement and errors

### **GitHub Actions**
- **Workflow Runs**: Monitor deployment success/failure rates
- **Deployment Frequency**: Track deployment patterns and timing
- **Secret Rotation**: Regularly update OAuth secrets and service account keys