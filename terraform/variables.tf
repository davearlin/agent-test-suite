# Project Configuration
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# Application Configuration
variable "app_name" {
  description = "Application name"
  type        = string
  default     = "dialogflow-tester"
}

variable "backend_image" {
  description = "Docker image for backend service"
  type        = string
  default     = "gcr.io/PROJECT_ID/dialogflow-tester-backend:latest"
}

variable "cors_origins" {
  description = "CORS allowed origins"
  type        = string
  default     = "*"
}

variable "create_firebase_app" {
  description = "Whether to create a new Firebase app (set to false if importing existing)"
  type        = bool
  default     = true
}

variable "existing_firebase_app_id" {
  description = "ID of existing Firebase web app to import (only used when create_firebase_app = false)"
  type        = string
  default     = ""
}

# Database Configuration
variable "database_name" {
  description = "Database name"
  type        = string
  default     = "dialogflow_tester"
}

variable "database_user" {
  description = "Database username for application"
  type        = string
  default     = "app_user"
}

variable "database_password" {
  description = "Database password for application user"
  type        = string
  sensitive   = true
  default     = ""
}

variable "db_tier" {
  description = "Database instance tier"
  type        = string
  default     = "db-f1-micro"
}

# OAuth Configuration
variable "google_oauth_client_id" {
  description = "Google OAuth Client ID"
  type        = string
  default     = ""
}

variable "google_oauth_client_secret" {
  description = "Google OAuth Client Secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_oauth_redirect_uri" {
  description = "Google OAuth Redirect URI (must match actual Cloud Run URL)"
  type        = string
  default     = ""
}

variable "frontend_url" {
  description = "Frontend URL for OAuth redirects after authentication"
  type        = string
  default     = ""
}

variable "jwt_secret_key" {
  description = "Secret key for JWT token signing (should be a long random string)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "google_api_key" {
  description = "Google API key for Generative Language API (LLM Judge service)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cloud_run_service_account" {
  description = "Service account email for Cloud Run backend service"
  type        = string
  default     = ""
}