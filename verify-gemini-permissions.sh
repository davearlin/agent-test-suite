#!/bin/bash

# GCP IAM Verification Script
# Run this to verify your Cloud Run service account has the correct permissions

PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "🔍 Verifying IAM permissions for Cloud Run service account"
echo "Project ID: $PROJECT_ID"
echo "Project Number: $PROJECT_NUMBER" 
echo "Service Account: $SERVICE_ACCOUNT"
echo ""

echo "📋 Required permissions for Gemini AI access:"
echo ""

# Check AI Platform User role
echo "1. Checking AI Platform User (roles/aiplatform.user):"
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:serviceAccount:$SERVICE_ACCOUNT AND bindings.role:roles/aiplatform.user" \
  | grep -q "roles/aiplatform.user" && echo "   ✅ GRANTED" || echo "   ❌ MISSING"

# Check ML Developer role  
echo "2. Checking ML Developer (roles/ml.developer):"
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:serviceAccount:$SERVICE_ACCOUNT AND bindings.role:roles/ml.developer" \
  | grep -q "roles/ml.developer" && echo "   ✅ GRANTED" || echo "   ❌ MISSING"

# Check Service Usage Consumer role
echo "3. Checking Service Usage Consumer (roles/serviceusage.serviceUsageConsumer):"
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:serviceAccount:$SERVICE_ACCOUNT AND bindings.role:roles/serviceusage.serviceUsageConsumer" \
  | grep -q "roles/serviceusage.serviceUsageConsumer" && echo "   ✅ GRANTED" || echo "   ❌ MISSING"

echo ""
echo "🔧 Required APIs:"
echo ""

# Check AI Platform API
echo "1. Checking AI Platform API (aiplatform.googleapis.com):"
gcloud services list --enabled --filter="name:aiplatform.googleapis.com" --format="value(name)" | grep -q "aiplatform.googleapis.com" && echo "   ✅ ENABLED" || echo "   ❌ DISABLED"

# Check Generative Language API
echo "2. Checking Generative Language API (generativelanguage.googleapis.com):"  
gcloud services list --enabled --filter="name:generativelanguage.googleapis.com" --format="value(name)" | grep -q "generativelanguage.googleapis.com" && echo "   ✅ ENABLED" || echo "   ❌ DISABLED"

echo ""
echo "💡 If any items show ❌ MISSING or ❌ DISABLED, run 'terraform apply' to fix them."