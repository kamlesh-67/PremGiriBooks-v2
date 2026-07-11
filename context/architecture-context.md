# Architecture Context

## Architecture Style

Premgiri Books ERP follows an **Offline-First Modular Monolith Architecture**.

The application is designed to run completely on a local computer or local office network without requiring an internet connection.

All business operations including Accounting, GST, Inventory, Billing, Purchasing, Reports, and Printing are executed locally.

Cloud connectivity is optional and reserved for future capabilities such as cloud backup, GST portal integration, mobile applications, and synchronization.

The system is divided into independent business modules that share common business engines instead of duplicating business logic.

---

# Technology Stack

| Layer           | Technology                              | Purpose                            |
| --------------- | --------------------------------------- | ---------------------------------- |
| Desktop Runtime | Electron                                | Cross-platform desktop application |
| Frontend        | Next.js 16 + React + TypeScript         | User Interface                     |
| UI Library      | Tailwind CSS + shadcn/ui                | Modern UI Components               |
| Backend         | Next.js Server Actions + Route Handlers | Local Business APIs                |
| Database        | PostgreSQL (Local)                      | Primary Database                   |
| ORM             | Prisma                                  | Database Access Layer              |
| Authentication  | Local Authentication                    | User Login & Security              |
| File Storage    | Local File System                       | PDFs, Images, Backups              |
| Reporting       | PDF & Excel Export                      | Business Reports                   |
| Validation      | Zod                                     | Input Validation                   |
| Logging         | Pino                                    | Application Logging                |

---

# Layered Architecture

```
┌────────────────────────────────────┐
│          Desktop (Electron)         │
└────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│      Presentation Layer (UI)        │
│ Dashboard                           │
│ Sales                               │
│ Purchase                            │
│ Inventory                           │
│ Accounting                          │
│ GST                                 │
│ Reports                             │
│ Settings                            │
└────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│        Business Layer               │
│ Voucher Engine                      │
│ Pricing Engine                      │
│ Inventory Engine                    │
│ GST Engine                          │
│ Reporting Engine                    │
└────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│          Data Layer                 │
│ Prisma ORM                          │
│ PostgreSQL                          │
│ Local File Storage                  │
└────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│     Future Cloud Services           │
│ Cloud Backup                        │
│ GST APIs                            │
│ Mobile App                          │
│ AI Services                         │
│ Sync                                │
└────────────────────────────────────┘
```

---

# Core Business Principles

## Voucher Driven

Every financial transaction must generate accounting vouchers.

Examples

- Sales Invoice
- Purchase Invoice
- Receipt Voucher
- Payment Voucher
- Contra Voucher
- Journal Voucher
- Sales Return
- Purchase Return

Financial reports must always be generated from voucher entries.

---

## Document Driven

Every transaction is treated as a business document.

Lifecycle

```
Draft
    ↓
Saved
    ↓
Approved
    ↓
Posted
    ↓
Voucher Generated
    ↓
Locked
    ↓
Cancelled (Optional)
```

---

## Engine Driven

Business rules must exist only inside business engines.

User Interface components must never calculate:

- GST
- Selling Price
- Margin
- Ledger Entries
- Inventory Movement

Screens only request services from the engines.

---

# Core Engines

## Voucher Engine

Responsibilities

- Double Entry Accounting
- Voucher Posting
- Journal Entries
- Ledger Posting
- Trial Balance
- Profit & Loss
- Balance Sheet
- Cash Book
- Bank Book
- Audit Trail

---

## Pricing Engine

Responsibilities

- Latest Purchase Cost
- Margin Profiles
- Price Lists
- Customer Pricing
- Dealer Pricing
- Wholesale Pricing
- Discount Rules
- Selling Price Calculation

---

## Inventory Engine

Responsibilities

- Stock In
- Stock Out
- Warehouse Management
- Stock Transfer
- Stock Adjustment
- Physical Verification
- Stock Ledger
- Stock Valuation

---

## GST Engine

Responsibilities

- GST Calculation
- CGST
- SGST
- IGST
- CESS
- HSN Summary
- GST Registers
- GSTR-1
- GSTR-3B

---

## Reporting Engine

Responsibilities

- Dashboard
- Financial Reports
- Sales Reports
- Purchase Reports
- Inventory Reports
- GST Reports
- Excel Export
- PDF Export

---

# Module Boundaries

## Authentication

Responsible for

- Login
- User Management
- Roles
- Permissions
- Session Management

---

## Company

Responsible for

- Company Details
- Branches
- Financial Years
- Banks
- Company Settings

---

## Masters

Responsible for

- Customers
- Suppliers
- Products
- Categories
- Brands
- Units
- Warehouses
- Employees
- HSN Codes
- GST Rates
- Price Lists
- Margin Profiles

Masters never generate accounting entries.

---

## Sales

Responsible for

- Quotations
- Sales Orders
- Delivery Challans
- Sales Invoices
- Sales Returns

Sales module communicates only through

- Pricing Engine
- Inventory Engine
- Voucher Engine
- GST Engine

---

## Purchase

Responsible for

- Purchase Orders
- Goods Receipt
- Purchase Invoices
- Purchase Returns

Purchase communicates only through shared business engines.

---

## Inventory

Responsible for

- Opening Stock
- Stock Adjustment
- Stock Transfer
- Warehouse Operations
- Physical Verification

Inventory module never creates accounting entries directly.

---

## Accounting

Responsible for

- Receipt Voucher
- Payment Voucher
- Contra Voucher
- Journal Voucher
- Ledger Inquiry

Accounting uses Voucher Engine.

---

## GST

Responsible for

- GST Reports
- GST Registers
- Return Generation

GST module never updates accounting directly.

---

## Employee

Responsible for

- Employee Master
- Attendance
- Salary
- Payroll

---

## Reports

Responsible only for presenting information.

Reports never modify business data.

---

# Data Storage

## PostgreSQL Database

Stores

- Companies
- Users
- Roles
- Customers
- Suppliers
- Products
- Inventory
- Vouchers
- Voucher Entries
- Ledgers
- GST Data
- Employees
- Business Settings

---

## Local File Storage

Stores

- Invoice PDFs
- Company Logos
- Product Images
- Excel Imports
- Excel Exports
- Backup Files
- Attachments

Database stores only file references.

---

# Offline Strategy

Premgiri Books ERP is designed to function completely offline.

No internet connection is required for

- Login
- Sales
- Purchase
- Inventory
- Accounting
- GST Calculation
- Reports
- Invoice Printing
- Barcode Printing
- Customer Management
- Supplier Management
- Backup

Internet is required only for future services.

---

# Security Model

- Local User Authentication
- Role-Based Access Control (RBAC)
- Company-Level Isolation
- Branch-Level Permissions
- Audit Logs
- Soft Delete
- Daily Automatic Backup
- Future Database Encryption

---

# Costing Strategy

Current Costing Method

- Latest Purchase Cost

Pricing Engine always uses the latest purchase cost for

- Selling Price Calculation
- Margin Calculation
- Inventory Valuation (Current Version)

Future versions may support

- FIFO
- Weighted Average
- Standard Cost

---

# Product Architecture

Supported Product Types

- Trading Product
- Service
- Expense Item

Reserved Product Types

- Formula Product (Future Release)

The Formula Product type is reserved for future manufacturing and automotive paint formulation features.

---

# Customer Architecture

Supported Customer Types

## Permanent Customer

- Customer Master
- Ledger
- Credit Limit
- Outstanding
- Statement

---

## Quick Customer

Created during billing.

Stores

- Name
- Mobile
- Address
- GSTIN
- Email

Can later be converted into a permanent customer.

---

## Walk-in Customer

- Default Cash Customer
- No Master Record
- No Ledger
- Fast Billing

---

# Future Architecture

The following modules are planned for future releases.

## Formula Management & Production

Designed for industries such as

- Automotive Paint Mixing
- Chemical Blending
- Ink Manufacturing
- Adhesives
- Lubricants

Planned Features

- Formula Management
- Recipe Library
- Manufacturer-wise Color Library
- Vehicle-wise Formula Library
- Production Orders
- Batch Manufacturing
- Raw Material Consumption
- Production Costing
- Formula Versioning
- Wastage Tracking
- On-Demand Production
- Finished Goods Management

This module will integrate with

- Pricing Engine
- Inventory Engine
- Voucher Engine
- GST Engine

without requiring architectural changes.

---

# Future Online Services

Planned cloud capabilities

- Cloud Backup
- Multi-System Synchronization
- Mobile Application
- Online Dashboard
- WhatsApp Integration
- GST Portal Integration
- E-Invoice
- E-Way Bill
- AI Assistant
- License Management

---

# Invariants

1. Every financial transaction must generate vouchers.
2. Posted documents cannot be edited.
3. Reports are read-only.
4. Business rules belong only inside business engines.
5. Modules communicate through shared services, never by directly modifying another module's data.
6. Pricing is always calculated by the Pricing Engine.
7. Inventory movements are managed only by the Inventory Engine.
8. GST calculations are managed only by the GST Engine.
9. Accounting reports derive data only from vouchers.
10. All core business operations must work without an internet connection.
11. Cloud services must remain optional and never block local business operations.
12. Future modules must integrate without changing existing module boundaries.

```

```
