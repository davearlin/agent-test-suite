# Configure the Google Cloud Provider
terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
  user_project_override = true
}

# Get project information
data "google_project" "project" {
  project_id = var.project_id
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "compute.googleapis.com",
    "servicenetworking.googleapis.com",
    "vpcaccess.googleapis.com",
    "artifactregistry.googleapis.com",
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
    "redis.googleapis.com",
    "aiplatform.googleapis.com",
    "generativelanguage.googleapis.com"
  ])
  
  project = var.project_id
  service = each.value
  
  disable_dependent_services = false
}

# Import existing VPC network if it exists
import {
  to = google_compute_network.vpc_network
  id = "projects/${var.project_id}/global/networks/${var.app_name}-vpc"
}

# VPC Network
resource "google_compute_network" "vpc_network" {
  name                    = "${var.app_name}-vpc"
  auto_create_subnetworks = false
  depends_on             = [google_project_service.required_apis]
  
  lifecycle {
    prevent_destroy = true
  }
}

# Subnet
# Import existing subnet if it exists
import {
  to = google_compute_subnetwork.subnet
  id = "projects/${var.project_id}/regions/${var.region}/subnetworks/${var.app_name}-subnet"
}

resource "google_compute_subnetwork" "subnet" {
  name          = "${var.app_name}-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc_network.id
  
  private_ip_google_access = true
  
  lifecycle {
    prevent_destroy = true
  }
}

# Import existing private IP range if it exists
import {
  to = google_compute_global_address.private_ip_range
  id = "projects/${var.project_id}/global/addresses/${var.app_name}-private-ip"
}

# Private IP range for services
resource "google_compute_global_address" "private_ip_range" {
  name          = "${var.app_name}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc_network.id
  
  lifecycle {
    prevent_destroy = true
  }
}

# Private connection for services (enable VPC peering for private IP)
resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc_network.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
  
  depends_on = [
    google_project_service.required_apis
  ]
}

# Import existing VPC connector if it exists
import {
  to = google_vpc_access_connector.vpc_connector
  id = "projects/${var.project_id}/locations/${var.region}/connectors/df-tester-connector"
}

# VPC Connector for Cloud Run
resource "google_vpc_access_connector" "vpc_connector" {
  name          = "df-tester-connector"
  region        = var.region
  network       = google_compute_network.vpc_network.name
  ip_cidr_range = "10.8.0.0/28"
  
  depends_on = [google_project_service.required_apis]
  
  lifecycle {
    prevent_destroy = true
  }
}

# Import existing Artifact Registry if it exists
import {
  to = google_artifact_registry_repository.docker_repo
  id = "projects/${var.project_id}/locations/${var.region}/repositories/${var.app_name}-images"
}

# Artifact Registry Repository
resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = "${var.app_name}-images"
  description   = "Docker repository for ${var.app_name}"
  format        = "DOCKER"
  
  depends_on = [google_project_service.required_apis]
  
  lifecycle {
    prevent_destroy = true
  }
}

# IAM binding for GitHub Actions to push to Artifact Registry (project level)
resource "google_project_iam_member" "github_actions_artifact_registry" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:github-actions-dialogflow@${var.project_id}.iam.gserviceaccount.com"
}

# IAM binding for GitHub Actions to act as service accounts
resource "google_project_iam_member" "github_actions_service_account_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:github-actions-dialogflow@${var.project_id}.iam.gserviceaccount.com"
}

# IAM binding for GitHub Actions to deploy Cloud Run services
resource "google_project_iam_member" "github_actions_cloud_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:github-actions-dialogflow@${var.project_id}.iam.gserviceaccount.com"
}

# IAM binding for the Cloud Run service account
resource "google_project_iam_member" "compute_service_account_cloud_run" {
  project = var.project_id
  role    = "roles/run.developer" 
  member  = "serviceAccount:${var.cloud_run_service_account}"
}

# IAM binding for Gemini AI API access
resource "google_project_iam_member" "compute_service_account_ai_platform" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${var.cloud_run_service_account}"
}

# IAM binding for Generative AI access  
resource "google_project_iam_member" "compute_service_account_ml_developer" {
  project = var.project_id
  role    = "roles/ml.developer"
  member  = "serviceAccount:${var.cloud_run_service_account}"
}

# IAM binding for Service Usage (required for API discovery)
resource "google_project_iam_member" "compute_service_account_service_usage" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageConsumer"
  member  = "serviceAccount:${var.cloud_run_service_account}"
}

# IAM binding for Cloud SQL Client (required for Cloud SQL Connector)
resource "google_project_iam_member" "compute_service_account_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${var.cloud_run_service_account}"
}

# Import existing SQL database instance if it exists
import {
  to = google_sql_database_instance.postgres
  id = "projects/${var.project_id}/instances/${var.app_name}-postgres-${var.environment}"
}

# Import existing SQL database if it exists
import {
  to = google_sql_database.database
  id = "projects/${var.project_id}/instances/${var.app_name}-postgres-${var.environment}/databases/${var.database_name}"
}

# Cloud SQL Database
resource "google_sql_database_instance" "postgres" {
  name             = "${var.app_name}-postgres-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region
  
  settings {
    tier = var.db_tier
    
    ip_configuration {
      ipv4_enabled    = false  # Disable public IP completely
      private_network = google_compute_network.vpc_network.id
      ssl_mode        = "ALLOW_UNENCRYPTED_AND_ENCRYPTED"  # For private network, SSL not strictly required
    }
    
    backup_configuration {
      enabled    = true
      start_time = "03:00"
    }
    
    database_flags {
      name  = "max_connections"
      value = "100"
    }
    
    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }
  }
  
  depends_on = [google_service_networking_connection.private_vpc_connection]
  deletion_protection = var.environment == "prod"
}

# Use the existing database password from variable
# Note: Database password is managed externally to prevent disruption

# SQL Database
resource "google_sql_database" "database" {
  name     = var.database_name
  instance = google_sql_database_instance.postgres.name
}

# Update password for existing app_user_dev
resource "google_sql_user" "app_user_password_update" {
  name     = var.database_user
  password = var.database_password
  instance = google_sql_database_instance.postgres.name
  type     = "BUILT_IN"
}

# Wait for Redis API to propagate after enablement
resource "time_sleep" "wait_for_redis_api" {
  depends_on = [google_project_service.required_apis]
  
  create_duration = "60s"
}

# Import existing Redis instance if it exists
import {
  to = google_redis_instance.cache
  id = "projects/${var.project_id}/locations/${var.region}/instances/${var.app_name}-redis-${var.environment}"
}

# Redis Memorystore instance
resource "google_redis_instance" "cache" {
  name           = "${var.app_name}-redis-${var.environment}"
  tier           = "BASIC"
  memory_size_gb = 1
  region         = var.region
  
  authorized_network = google_compute_network.vpc_network.name
  
  depends_on = [
    google_project_service.required_apis,
    time_sleep.wait_for_redis_api
  ]
}

# Import existing Cloud Run service if it exists
import {
  to = google_cloud_run_service.backend
  id = "locations/${var.region}/namespaces/${var.project_id}/services/${var.app_name}-backend-${var.environment}"
}

# Cloud Run Service
resource "google_cloud_run_service" "backend" {
  name     = "${var.app_name}-backend-${var.environment}"
  location = var.region
  
  template {
    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale"        = "10"
        "run.googleapis.com/vpc-access-connector" = google_vpc_access_connector.vpc_connector.name
        "run.googleapis.com/vpc-access-egress"    = "all-traffic"
        "run.googleapis.com/cpu-throttling"       = "false"
        "run.googleapis.com/execution-environment" = "gen2"
        "run.googleapis.com/startup-cpu-boost"    = "true"
      }
    }
    
    spec {
      container_concurrency = 80
      timeout_seconds      = 900
      service_account_name = var.cloud_run_service_account
      
      containers {
        image = var.backend_image
        
        ports {
          container_port = 8000
        }
        
        resources {
          limits = {
            cpu    = "1000m"
            memory = "2Gi"
          }
        }
        
        startup_probe {
          tcp_socket {
            port = 8000
          }
          failure_threshold    = 1
          period_seconds       = 240
          timeout_seconds      = 240
        }
        
        env {
          name  = "POSTGRES_SERVER"
          value = google_sql_database_instance.postgres.private_ip_address
        }
        
        env {
          name  = "POSTGRES_USER"
          value = var.database_user
        }
        
        env {
          name  = "POSTGRES_PASSWORD"
          value = var.database_password
        }
        
        env {
          name  = "POSTGRES_DB"
          value = var.database_name
        }
        
        env {
          name  = "POSTGRES_CONNECTION_NAME"
          value = google_sql_database_instance.postgres.connection_name
        }
        
        env {
          name  = "USE_IAM_AUTH"
          value = "false"
        }
        
        env {
          name  = "GOOGLE_CLOUD_PROJECT"
          value = var.project_id
        }
        
        env {
          name  = "GOOGLE_API_KEY"
          value = var.google_api_key
        }
        
        env {
          name  = "ENVIRONMENT"
          value = var.environment
        }
        
        env {
          name  = "SECRET_KEY"
          value = var.jwt_secret_key
        }
        
        env {
          name  = "CORS_ORIGINS"
          value = var.cors_origins
        }
        
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
          value = var.google_oauth_redirect_uri
        }
        
        env {
          name  = "FRONTEND_URL"
          value = var.frontend_url
        }
        
        env {
          name  = "REDIS_URL"
          value = "redis://${google_redis_instance.cache.host}:${google_redis_instance.cache.port}"
        }
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
  
  depends_on = [google_project_service.required_apis]
  
  lifecycle {
    ignore_changes = [
      # Ignore annotations that may be updated by gcloud CLI
      template[0].metadata[0].annotations["run.googleapis.com/operation-id"],
      template[0].metadata[0].annotations["run.googleapis.com/client-name"],
      template[0].metadata[0].annotations["run.googleapis.com/client-version"]
    ]
  }
}

# Firebase Configuration
resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.required_apis]
}

# Import existing Firebase web app to avoid quota issues
# Firebase Web App Management
# 
# For NEW environments (prod, staging, etc.):
#   1. Set create_firebase_app = true in terraform.tfvars
#   2. Let Terraform create a new Firebase app
#
# For EXISTING environments (like this dev environment):
#   1. Set create_firebase_app = false in terraform.tfvars  
#   2. Set existing_firebase_app_id to the actual Firebase app ID
#   3. Run: terraform import google_firebase_web_app.frontend[0] projects/PROJECT_ID/webApps/APP_ID
#
# This approach allows each environment to have its own Firebase app configuration
# without hardcoding app IDs in the Terraform code.
resource "google_firebase_web_app" "frontend" {
  count    = var.create_firebase_app ? 1 : 0
  provider = google-beta
  
  project      = var.project_id
  display_name = "${var.app_name} Frontend ${var.environment}"
  
  # Prevent recreation on minor name changes
  lifecycle {
    ignore_changes = [display_name]
  }
  
  depends_on = [google_firebase_project.default]
}

# Firebase Hosting Site
resource "google_firebase_hosting_site" "frontend" {
  count    = var.create_firebase_app ? 1 : 0
  provider = google-beta
  project  = var.project_id
  site_id  = "dialogflow-agent-tester-${var.environment}"
  
  depends_on = [google_firebase_web_app.frontend]
}

# IAM policy to allow unauthenticated invocations
resource "google_cloud_run_service_iam_binding" "backend_noauth" {
  location = google_cloud_run_service.backend.location
  project  = google_cloud_run_service.backend.project
  service  = google_cloud_run_service.backend.name
  role     = "roles/run.invoker"
  members = [
    "allUsers",
  ]
}