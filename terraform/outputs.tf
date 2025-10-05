# Application URLs
output "backend_url" {
  description = "URL of the backend Cloud Run service"
  value       = google_cloud_run_service.backend.status[0].url
}

output "frontend_url" {
  description = "URL of the frontend Firebase Hosting site"
  value       = var.create_firebase_app ? "https://${google_firebase_hosting_site.frontend[0].site_id}.web.app" : "Firebase hosting not managed by Terraform"
}

output "frontend_site_id" {
  description = "Firebase Hosting site ID"
  value       = var.create_firebase_app ? google_firebase_hosting_site.frontend[0].site_id : "Firebase hosting not managed by Terraform"
}

# Database Information
output "database_connection_name" {
  description = "Database connection name"
  value       = google_sql_database_instance.postgres.connection_name
}

output "database_private_ip" {
  description = "Database private IP address"
  value       = google_sql_database_instance.postgres.private_ip_address
  sensitive   = true
}

# Network Information
output "vpc_network_name" {
  description = "VPC network name"
  value       = google_compute_network.vpc_network.name
}

output "vpc_connector_name" {
  description = "VPC connector name"
  value       = google_vpc_access_connector.vpc_connector.name
}

# Project Information
output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP region"
  value       = var.region
}

# Artifact Registry Information
output "docker_repository" {
  description = "Artifact Registry Docker repository"
  value       = google_artifact_registry_repository.docker_repo.name
}

output "docker_registry_url" {
  description = "Artifact Registry Docker registry URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}"
}