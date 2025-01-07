# LedgerLink Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Core Applications](#core-applications)
4. [Features](#features)
5. [Technical Implementation](#technical-implementation)
6. [Database Schema](#database-schema)
7. [API Documentation](#api-documentation)
8. [Frontend Implementation](#frontend-implementation)
9. [Security Considerations](#security-considerations)
10. [Deployment](#deployment)

## Project Overview

LedgerLink is a comprehensive billing management system built using Django framework. The system is designed to handle complex billing scenarios for businesses, featuring automated invoice generation, customer management, and detailed reporting capabilities.

### Key Features
- Customer management with detailed profiles
- Service-based billing configuration
- Dynamic billing rules and calculations
- Automated report generation
- Export capabilities (CSV, PDF)
- Real-time billing analytics

## System Architecture

### Technology Stack
- Backend: Django 5.0
- Database: PostgreSQL
- Frontend: Bootstrap 5, Tailwind CSS
- Authentication: Django's built-in authentication system
- API: Django REST Framework
- Additional Libraries: crispy-forms, whitenoise

### Project Structure
The project follows a modular architecture with separate Django applications for different functionalities:

```
LedgerLink/
├── billing/          # Billing logic and reports
├── customers/        # Customer management
├── services/         # Service definitions
├── orders/          # Order processing
├── rules/           # Billing rules engine
├── customer_services/# Customer-specific service config
├── Main/            # Core application features
└── static/          # Static assets
```

## Core Applications

### Billing Application
The billing application is the core of the system, handling:
- Billing calculations based on complex rules
- Report generation
- Export functionality

Key components:
- `BillingCalculator`: Handles complex billing calculations
- `RuleEvaluator`: Processes billing rules and conditions
- `ServiceCost`: Manages service-specific cost calculations

### Customer Management
Handles customer-related operations:
- Customer profile management
- Customer service associations
- Address and contact information

### Services Management
Manages service configurations:
- Service definitions
- Pricing rules
- Service-customer associations

## Features

### 1. Billing Reports
- Custom date range selection
- Customer-specific filtering
- Multiple output formats (JSON, CSV, PDF)
- Detailed service breakdowns
- Summary statistics

### 2. Customer Management
- Comprehensive customer profiles
- Service association management
- Address and contact management
- Activity tracking

### 3. Service Configuration
- Flexible service definitions
- Custom pricing rules
- Customer-specific pricing
- Service activation/deactivation

## Technical Implementation

### Billing Calculator Implementation
The billing calculator (`billing_calculator.py`) implements complex billing logic:

```python
class BillingCalculator:
    def calculate_service_cost(self, customer_service, order):
        # Calculate costs based on service type
        if customer_service.service.charge_type == 'single':
            return base_price
        elif customer_service.service.charge_type == 'quantity':
            return base_price * quantity
```

### Rule Evaluation System
The rule evaluation system supports complex billing rules:
- Field-based conditions
- Multiple operators (gt, lt, eq, contains)
- Logical combinations (AND, OR, NOT)
- SKU-based calculations

### Report Generation
Reports are generated using a combination of:
- Django ORM for data retrieval
- Custom calculation logic
- Template rendering for presentation
- Export formatting for different outputs

## Database Schema

### Core Tables
1. Customer
```sql
CREATE TABLE Customer (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(100),
    email VARCHAR(254) UNIQUE,
    phone VARCHAR(20),
    created_at TIMESTAMP
);
```

2. Service
```sql
CREATE TABLE Service (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100),
    charge_type VARCHAR(50)
);
```

3. CustomerService
```sql
CREATE TABLE CustomerService (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES Customer(id),
    service_id INTEGER REFERENCES Service(id),
    unit_price DECIMAL(10,2)
);
```

## API Documentation

### Billing Report API
Endpoint: `/billing/api/generate-report/`
Method: POST
Authentication: Required

Request Body:
```json
{
    "customer_id": integer,
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "output_format": "json|csv|pdf"
}
```

Response:
```json
{
    "report": {
        "total_amount": "decimal",
        "orders": [...],
        "service_totals": {...}
    }
}
```

## Frontend Implementation

### Component Structure
- Base template with common layout
- Responsive navigation
- Dynamic form handling
- Real-time data updates

### Key Frontend Features
1. Report Interface
   - Dynamic date selection
   - Real-time preview
   - Export options
   - Interactive data display

2. Dashboard
   - Summary widgets
   - Quick actions
   - Recent activity display

### JavaScript Implementation
The frontend uses vanilla JavaScript with key functionality:
- AJAX requests for data fetching
- Dynamic DOM updates
- Form validation
- Export handling

## Security Considerations

1. Authentication
   - Django's built-in authentication
   - Login required for all sensitive operations
   - CSRF protection

2. Data Protection
   - Input validation
   - SQL injection prevention
   - XSS protection

3. API Security
   - Token-based authentication
   - Request validation
   - Rate limiting

## Deployment

### Requirements
- Python 3.8+
- PostgreSQL 12+
- Node.js (for asset compilation)

### Environment Configuration
```python
DEBUG = False
ALLOWED_HOSTS = ['your-domain.com']
DATABASE_URL = 'postgresql://...'
```

### Static Files
- Served using Whitenoise
- Compressed and cached
- CDN-ready configuration

### Logging
- Structured logging setup
- Error tracking
- Performance monitoring

## Maintenance and Updates

### Regular Tasks
1. Database backups
2. Log rotation
3. Security updates
4. Performance monitoring

### Troubleshooting
Common issues and solutions are documented in the maintenance guide.
