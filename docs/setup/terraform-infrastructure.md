# Terraform Infrastructure Management

## 🏗️ **Infrastructure as Code Overview**

The Dialogflow Test Suite uses **Terraform** to manage all Google Cloud Platform infrastructure as code, ensuring consistent, repeatable deployments and proper resource management.

## 📋 **Managed Resources**

### **Core Infrastructure**
- **VPC Network**: `df-tester-vpc` with custom subnets
- **VPC Connector**: `df-tester-connector` for Cloud Run networking
- **Global Address**: `df-tester-global-address` for database connectivity
- **Cloud SQL**: PostgreSQL 15 database with VPC connection
- **Cloud Run**: Backend service with OAuth environment variables
- **Artifact Registry**: Docker image storage

### **Import Blocks for Existing Resources**
All existing resources are properly imported into Terraform state to prevent 409 "already exists" conflicts:

```hcl
import {
  to = google_compute_network.vpc_network
  id = "projects/your-gcp-project-id/global/networks/df-tester-vpc"
}

import {
  to = google_artifact_registry_repository.docker_repo
  id = "projects/your-gcp-project-id/locations/us-central1/repositories/dialogflow-tester"
}

import {
  to = google_cloud_run_service.backend
  id = "locations/us-central1/namespaces/your-gcp-project-id/services/dialogflow-tester-backend-dev"
}
```

## 🔐 **OAuth Secret Management**

### **GitHub Actions Integration**
OAuth secrets are managed via GitHub Actions environment variables:

```yaml
env:
  TF_VAR_google_oauth_client_id: ${{ secrets.GOOGLE_OAUTH_CLIENT_ID }}
  TF_VAR_google_oauth_client_secret: ${{ secrets.GOOGLE_OAUTH_CLIENT_SECRET }}
  TF_VAR_jwt_secret_key: ${{ secrets.JWT_SECRET_KEY }}
```

### **Terraform Configuration**
```hcl
resource "google_cloud_run_service" "backend" {
  template {
    spec {
      containers {
        env {
          name  = "GOOGLE_OAUTH_CLIENT_ID"
          value = var.google_oauth_client_id
        }
        env {
          name  = "GOOGLE_OAUTH_CLIENT_SECRET"
          value = var.google_oauth_client_secret
        }
        env {
          name  = "JWT_SECRET_KEY"
          value = var.jwt_secret_key
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      metadata[0].annotations["client.knative.dev/user-image"],
      metadata[0].annotations["run.googleapis.com/client-name"],
      metadata[0].annotations["run.googleapis.com/client-version"],
      metadata[0].annotations["serving.knative.dev/creator"],
      metadata[0].annotations["serving.knative.dev/lastModifier"],
      template[0].metadata[0].annotations["client.knative.dev/user-image"],
      template[0].metadata[0].annotations["run.googleapis.com/client-name"],
      template[0].metadata[0].annotations["run.googleapis.com/client-version"]
    ]
  }
}
```

## 🚀 **Deployment Workflow**

### **GitHub Actions Pipeline**
The deployment is fully automated via `.github/workflows/deploy.yml`:

1. **Infrastructure Deployment**: Terraform plan and apply
2. **Backend Deployment**: Docker build and push to Cloud Run
3. **Frontend Deployment**: Vite build and Firebase deployment
4. **Environment Variable Management**: Automatic .env.local handling

### **Local Development Commands**
```bash
# Initialize Terraform
cd terraform
terraform init

# Plan infrastructure changes
terraform plan

# Apply infrastructure changes
terraform apply

# Import existing resource (if needed)
terraform import google_compute_network.vpc_network projects/your-gcp-project-id/global/networks/df-tester-vpc
```

## 🛠️ **Troubleshooting**

### **409 "Already Exists" Errors**
If you encounter 409 errors during deployment:

1. **Check Import Blocks**: Ensure all existing resources have corresponding import blocks
2. **Update State**: Run `terraform import` for any missing resources
3. **Lifecycle Rules**: Add lifecycle rules to ignore gcloud CLI annotations

### **OAuth Configuration Issues**
If OAuth isn't working after deployment:

1. **Verify Secrets**: Check GitHub repository secrets are correctly set
2. **Environment Variables**: Ensure TF_VAR variables are properly configured
3. **Cloud Run Service**: Verify environment variables are applied to the service

### **Environment Variable Precedence**
If the frontend uses wrong API endpoints:

1. **Clear Browser Cache**: Hard refresh with Ctrl+Shift+R
2. **Check .env.local**: Ensure .env.local is not overriding production settings
3. **Verify Build**: Check that the built JavaScript contains the correct backend URL

## 📚 **Best Practices**

### **Resource Management**
- **Always Import First**: Import existing resources before managing with Terraform
- **Use Lifecycle Rules**: Prevent unwanted changes to annotations and metadata
- **Version Control**: Keep terraform.tfstate in version control for team collaboration

### **Security**
- **Secret Management**: Use GitHub Actions secrets for sensitive variables
- **IAM Permissions**: Follow principle of least privilege for service accounts
- **VPC Security**: Use VPC connectors for secure database connectivity

### **Deployment**
- **Staging First**: Test infrastructure changes in development environment
- **Rollback Plan**: Keep previous Terraform state for quick rollbacks
- **Monitoring**: Monitor Cloud Run services and database performance after deployments