# OAuth Environment Variables Configuration Guide

This document outlines how OAuth environment variables are configured across all deployment contexts for the Dialogflow Agent Tester application.

## Overview

The application uses Google OAuth for authentication and requires three environment variables:
- `GOOGLE_CLIENT_ID`: OAuth 2.0 client ID from Google Cloud Console
- `GOOGLE_CLIENT_SECRET`: OAuth 2.0 client secret from Google Cloud Console  
- `GOOGLE_REDIRECT_URI`: Callback URL for OAuth flow completion

## Current OAuth Credentials

**Client ID**: `[CONFIGURED VIA TERRAFORM VARIABLES]`
**Client Secret**: `[STORED IN GITHUB SECRETS]`

> **Security Note**: OAuth credentials are now managed through:
> - GitHub repository secrets for CI/CD deployments
> - Terraform variables for infrastructure management
> - Never stored in source code or documentation

## Security Requirements

### JWT Secret Key
The application requires a `JWT_SECRET_KEY` for signing authentication tokens. This must be:
- A long, random string (64+ characters)
- Different for each environment (dev/staging/prod)
- Never stored in source code
- Kept secure as it can be used to forge user sessions

**Generate a new secret key:**
```bash
# Using Python
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Using OpenSSL
openssl rand -base64 64 | tr -d '\n'
```

## Configuration by Context

### 1. Production Deployment (Google Cloud Run)

**Method**: Terraform with GitHub Actions secrets
**Location**: `terraform/main.tf` lines 248-259
**Configuration**:
```terraform
env {
  name  = "GOOGLE_CLIENT_ID"
  value = var.google_oauth_client_id
}

env {
  name  = "GOOGLE_CLIENT_SECRET"
  value = var.google_oauth_client_secret
}

env {
  name  = "GOOGLE_REDIRECT_URI"
  value = "https://${google_firebase_hosting_site.frontend.default_url}/auth/callback"
}
```

**Required GitHub Secrets**:
- `GOOGLE_OAUTH_CLIENT_ID`: Set to the client ID above
- `GOOGLE_OAUTH_CLIENT_SECRET`: Set to the client secret above
- `JWT_SECRET_KEY`: A secure random string for JWT token signing

**Setup Commands**:
```bash
# Set OAuth secrets in your GitHub repository settings
gh secret set GOOGLE_OAUTH_CLIENT_ID --body "your-client-id.apps.googleusercontent.com"
gh secret set GOOGLE_OAUTH_CLIENT_SECRET --body "your-oauth-client-secret"

# Generate and set JWT secret key
JWT_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(64))")
gh secret set JWT_SECRET_KEY --body "$JWT_SECRET"
```

### 2. Local Development (Docker Compose)

**Method**: Environment variables with fallback defaults
**Location**: `docker-compose.yml` lines 42-44
**Configuration**:
```yaml
environment:
  - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
  - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}
  - GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI:-http://localhost:8000/api/v1/auth/google/callback}
```

**Setup**: Create `.env` file in project root:
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-oauth-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/callback
```

### 3. Backend Code Configuration

**Method**: Environment variable reading with Pydantic Settings
**Location**: `backend/app/core/config.py`
**Configuration**:
```python
class Settings(BaseSettings):
    google_client_id: str = Field(..., env="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field(..., env="GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str = Field(..., env="GOOGLE_REDIRECT_URI")
```

### 4. Terraform Variables

**Definitions**: `terraform/variables.tf`
```terraform
variable "google_oauth_client_id" {
  description = "Google OAuth client ID"
  type        = string
  sensitive   = true
}

variable "google_oauth_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
}
```

**Values**: Passed via TF_VAR environment variables in GitHub Actions

### 5. GitHub Actions Workflow

**Method**: Environment variables passed to Terraform
**Location**: `.github/workflows/deploy.yml` lines 141-143, 156-157
**Configuration**:
```yaml
env:
  TF_VAR_google_oauth_client_id: ${{ secrets.GOOGLE_OAUTH_CLIENT_ID }}
  TF_VAR_google_oauth_client_secret: ${{ secrets.GOOGLE_OAUTH_CLIENT_SECRET }}
```

## Google Cloud Console Configuration

The OAuth client must be configured with appropriate redirect URIs:

**Authorized redirect URIs**:
- `https://your-frontend-url.web.app/auth/callback` (Production)
- `http://localhost:3000/auth/callback` (Local frontend development)
- `http://localhost:8000/api/v1/auth/google/callback` (Local backend development)

## Security Considerations

1. **Production**: OAuth secrets are stored as GitHub repository secrets, never in code
2. **Local Development**: OAuth secrets should be in `.env` file (gitignored)
3. **Terraform**: Variables marked as `sensitive = true` to prevent logging
4. **Cloud Run**: Environment variables are encrypted at rest

## Troubleshooting

### Common Issues:

1. **"Setup Required" on production**: GitHub secrets not set or terraform not deployed
2. **OAuth redirect mismatch**: Check Google Cloud Console authorized redirect URIs
3. **Local development OAuth fails**: Check `.env` file exists and has correct values
4. **Terraform deployment removes OAuth**: GitHub secrets not configured properly

### Verification Commands:

```bash
# Check Cloud Run environment variables
gcloud run services describe dialogflow-tester-backend-dev --region=us-central1 --project=your-gcp-project-id --format="yaml" | findstr "GOOGLE_CLIENT"

# Check GitHub secrets (requires GitHub CLI)
gh secret list

# Verify terraform will use secrets
cd terraform && terraform plan -var="project_id=your-gcp-project-id" -var="environment=dev"
```

## Next Steps

1. Set GitHub repository secrets using the commands above
2. Update Google Cloud Console OAuth client with production redirect URI
3. Test deployment pipeline to ensure OAuth variables persist
4. Verify OAuth flow works end-to-end in production

## Last Updated

Configuration verified as of: $(date)
Production URL: https://your-frontend-url.web.app
Backend URL: https://your-backend-url.run.app