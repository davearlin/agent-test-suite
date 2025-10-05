# Documentation

## 📋 Quick Navigation

### Setup Guides
- [**Developer Setup**](setup/developer-setup.md) - Complete setup guide for new developers
- [**GitHub Setup**](setup/github-setup.md) - Repository and CI/CD configuration
- [**Google Cloud Auth**](setup/google-auth.md) - Authentication configuration
- [**OAuth Setup**](setup/oauth-setup.md) - OAuth configuration for Google services

### User Guides  
- [**Quick Testing**](guides/quick-testing.md) - How to quickly test features

### Technical Documentation
- [**Agent Permission Filtering**](agent-permission-filtering.md) - How agent accessibility works
- [**Architecture & Design**](../design/) - System architecture and design documents
- [**Main README**](../README.md) - Project overview, setup, and deployment information

## 📁 Documentation Structure

```
docs/
├── README.md           # This file - documentation index
├── setup/              # Setup and configuration guides
│   ├── developer-setup.md
│   ├── github-setup.md
│   ├── google-auth.md
│   └── oauth-setup.md
└── guides/             # User guides and tutorials
    └── quick-testing.md

design/                 # Technical design documents
├── system-architecture.md
├── deployment-devops.md
└── ...

.agents/               # AI agent context and handoff docs
├── agent-handoff.md
├── deployment-guide.md
└── ...
```

## 🔗 Related Resources

- **Test Data**: [`/test-data/`](../test-data/) - CSV files for testing
- **Infrastructure**: [`/terraform/`](../terraform/) - Infrastructure as Code