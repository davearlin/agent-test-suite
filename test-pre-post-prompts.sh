#!/bin/bash
# Test runner script for pre/post prompt functionality
# This script runs comprehensive tests for the pre/post prompt feature

set -e

echo "🧪 Running Pre/Post Prompt Feature Tests"
echo "========================================"

# Backend Tests
echo ""
echo "🔧 Running Backend Tests..."
echo "----------------------------"

cd backend

# Run specific pre/post prompt tests
echo "Running pre/post prompt specific tests..."
python -m pytest tests/test_pre_post_prompt.py -v

# Run all tests to ensure no regression
echo ""
echo "Running all backend tests..."
python -m pytest tests/ -v

cd ..

# Frontend Tests  
echo ""
echo "🎨 Running Frontend Tests..."
echo "----------------------------"

cd frontend

# Run specific pre/post prompt tests
echo "Running pre/post prompt specific tests..."
npm test -- PrePostPrompt.test.tsx

# Run all frontend tests
echo ""
echo "Running all frontend tests..."
npm test

cd ..

echo ""
echo "✅ All Tests Completed Successfully!"
echo ""
echo "🔍 Summary:"
echo "- Backend tests verify that test runs properly use message sequences"
echo "- Frontend tests verify that UI displays pre/post prompt configuration"
echo "- Integration ensures test runs behave the same as quick tests"