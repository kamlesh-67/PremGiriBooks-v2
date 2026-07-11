# Product Requirements Document (PRD)

**Project Name:** Premgiri Books ERP
**Version:** 1.0.0
**Status:** Draft
**Primary Market:** India
**Application Type:** Offline-First Desktop ERP

---

# 1. Executive Summary

Premgiri Books ERP is an offline-first, AI-ready Enterprise Resource Planning (ERP) application designed specifically for Indian trading businesses.

The application combines Accounting, GST, Inventory, Sales, Purchase, Pricing, Customer Management, Supplier Management, Employee Management, and Financial Reporting into a single desktop application.

Unlike traditional accounting software, the system is designed around reusable business engines, modular architecture, and AI-assisted development, making it scalable, maintainable, and extensible.

---

# 2. Vision

Build a modern ERP that allows small and medium Indian businesses to manage their complete business operations from a single application while remaining fast, reliable, and fully functional without an internet connection.

---

# 3. Objectives

The application must provide:

* Complete Double Entry Accounting
* GST Compliant Billing
* Inventory Management
* Purchase Management
* Sales Management
* Voucher Based Accounting
* Pricing & Margin Management
* Financial Reporting
* Employee Management
* Multi Company Support
* Multi Branch Support
* AI-Friendly Modular Architecture

---

# 4. Target Market

Premgiri Books ERP is designed primarily for Indian trading businesses.

Supported business categories include:

* Automotive Spare Parts
* Automotive Paint Dealers
* Hardware Stores
* Retail Shops
* Wholesale Businesses
* Distribution Businesses
* Electrical Shops
* Industrial Supply Stores
* General Trading Companies

Future versions may support manufacturing and service industries.

---

# 5. Product Scope

## Included in MVP

* Authentication
* Company Management
* Financial Year Management
* Customer Management
* Supplier Management
* Product Management
* Inventory
* Purchase
* Sales
* Accounting
* GST
* Reports
* Employee Management
* Pricing Engine
* Margin Profiles
* Dashboard

---

## Out of Scope (MVP)

* Formula Management
* Recipe Management
* Automotive Paint Mixing
* Batch Manufacturing
* Production Orders
* Manufacturing BOM
* Cloud Synchronization
* Mobile Application
* GST Portal Integration
* E-Invoice
* E-Way Bill
* CRM
* Service Management
* AI Business Assistant

These features are planned for future releases.

---

# 6. Product Principles

The application follows the following principles.

## Offline First

The application must function completely without internet connectivity.

Internet is required only for optional future services.

---

## Business First

Business workflows are prioritized over visual effects.

---

## Keyboard First

All high-frequency workflows should support efficient keyboard navigation.

---

## Modular

Every module should be independent and reusable.

---

## AI Ready

The architecture should enable AI agents to understand, extend, and maintain the application with minimal ambiguity.

---

# 7. Architecture Principles

The system follows:

* Offline-First Architecture
* Modular Monolith
* Domain-Driven Design
* Voucher-Driven Accounting
* Document-Driven Workflow
* Engine-Based Business Logic

---

# 8. Core Business Engines

## Voucher Engine

Responsible for:

* Journal Entries
* Ledger Posting
* Trial Balance
* Profit & Loss
* Balance Sheet
* Audit Trail

---

## Pricing Engine

Responsible for:

* Latest Purchase Cost
* Margin Profiles
* Price Lists
* Customer Pricing
* Selling Price Calculation
* Discount Rules

---

## Inventory Engine

Responsible for:

* Stock Movement
* Warehouse Management
* Stock Valuation
* Stock Ledger
* Stock Adjustment

---

## GST Engine

Responsible for:

* GST Calculation
* GST Registers
* GSTR-1
* GSTR-3B
* HSN Summary

---

## Reporting Engine

Responsible for:

* Dashboards
* Financial Reports
* Sales Reports
* Purchase Reports
* Inventory Reports
* GST Reports

---

# 9. Core Modules

* Dashboard
* Authentication
* Company
* Customers
* Suppliers
* Products
* Inventory
* Sales
* Purchase
* Accounting
* GST
* Reports
* Employees
* Settings

---

# 10. Product Types

The system supports multiple product types.

## Trading Product

Purchased and sold directly.

---

## Service

Non-stock service items.

---

## Expense Item

Used for accounting transactions.

---

## Formula Product (Future)

Reserved for future formula-based manufacturing.

---

# 11. Customer Types

## Permanent Customer

* Stored in Customer Master
* Ledger Created
* Credit Limit
* Outstanding Tracking
* Statements

---

## Quick Customer

Created directly during billing.

Stores:

* Name
* Mobile
* Address
* GSTIN
* Email

Can later be converted into a permanent customer.

---

## Walk-in Customer

* No master record
* No ledger
* Cash customer
* Fast billing

---

# 12. Pricing & Margin System

Supports:

* Margin Profiles
* Price Lists
* Retail Pricing
* Wholesale Pricing
* Dealer Pricing
* Customer Pricing
* Quantity Pricing
* Promotional Pricing

The company can choose:

* Margin Based Pricing
* Markup Based Pricing

Latest Purchase Cost is used as the default costing method.

---

# 13. Inventory System

Supports:

* Opening Stock
* Stock In
* Stock Out
* Stock Adjustment
* Warehouse Management
* Physical Verification
* Reorder Levels
* Stock Reports

Every stock movement creates an inventory transaction.

---

# 14. Sales Management

Supports:

* Quotations
* Sales Orders
* Delivery Challans
* Sales Invoices
* Sales Returns
* Credit Notes
* Debit Notes

Features:

* Quick Customer
* Barcode Support
* Fast Product Search
* Keyboard Billing
* Multiple Payment Modes
* PDF Printing

---

# 15. Purchase Management

Supports:

* Purchase Orders
* Goods Receipt
* Purchase Invoices
* Purchase Returns

Latest purchase updates inventory cost.

---

# 16. Accounting

Supports:

* Receipt Voucher
* Payment Voucher
* Contra Voucher
* Journal Voucher
* Ledger
* Trial Balance
* Cash Book
* Bank Book
* Profit & Loss
* Balance Sheet

Every financial transaction creates vouchers.

---

# 17. GST

Supports:

* CGST
* SGST
* IGST
* CESS
* Reverse Charge
* HSN Summary
* GSTR-1
* GSTR-3B
* GST Registers

---

# 18. Reports

Financial

* Trial Balance
* Profit & Loss
* Balance Sheet
* Cash Flow

Operational

* Sales Reports
* Purchase Reports
* Inventory Reports
* Customer Reports
* Supplier Reports
* GST Reports

---

# 19. Security

The application must support:

* Local Authentication
* Role-Based Access Control
* Company Isolation
* Branch Permissions
* Audit Logs
* Soft Delete
* Daily Backup

---

# 20. Offline Strategy

The application must work completely offline.

Offline operations include:

* Login
* Sales
* Purchase
* Inventory
* Accounting
* GST
* Reports
* Printing

Cloud connectivity is optional and reserved for future features.

---

# 21. Non-Functional Requirements

Performance

* Dashboard < 2 seconds
* Invoice Save < 1 second
* Product Search < 300ms
* Customer Search < 300ms

Reliability

* Automatic Backup
* Data Integrity
* Transaction Safety

Maintainability

* Modular Architecture
* Shared Business Engines
* Strict TypeScript
* Complete Documentation

---

# 22. Future Roadmap

## Phase 2

* Employee Payroll
* Multi Branch Improvements
* Barcode Printing
* Excel Import / Export
* Advanced Reports

## Phase 3

* Formula Management
* Production Engine
* Automotive Paint Mixing
* Batch Manufacturing
* Production Costing
* Formula Versioning

## Phase 4

* Mobile Application
* Cloud Backup
* Cloud Synchronization
* GST Portal Integration
* AI Assistant
* E-Invoice
* E-Way Bill

---

# 23. Success Metrics

The project is successful when:

* Company setup can be completed in minutes.
* Sales invoices automatically generate vouchers.
* Inventory updates correctly after every transaction.
* Financial statements are generated from voucher data.
* GST reports are accurate.
* Billing is fast and keyboard-friendly.
* The application operates fully offline.
* Business logic remains modular and reusable.

---

# 24. Assumptions

* Businesses use GST-compliant accounting.
* Latest Purchase Cost is the default costing method.
* Desktop application is the primary deployment target.
* PostgreSQL is the local database.
* Internet is optional.

---

# 25. Constraints

* MVP excludes manufacturing features.
* MVP excludes cloud synchronization.
* MVP excludes Formula Management.
* MVP excludes mobile applications.
* MVP focuses on Indian GST requirements.

---

# 26. Business Invariants

The following rules are mandatory and cannot be violated.

1. Every financial transaction must generate vouchers.
2. Every stock movement must create inventory transactions.
3. Posted documents cannot be edited.
4. Reports are read-only.
5. Pricing is calculated only by the Pricing Engine.
6. Inventory is managed only by the Inventory Engine.
7. GST is calculated only by the GST Engine.
8. Financial reports derive data only from vouchers.
9. Every document belongs to one company and one financial year.
10. Document numbers are unique within a company and financial year.
11. The application must work completely offline.
12. Cloud services must never interrupt local business operations.

---

# 27. Glossary

| Term             | Description                                            |
| ---------------- | ------------------------------------------------------ |
| Voucher          | Accounting transaction generated from a business event |
| Ledger           | Accounting account used for financial reporting        |
| Financial Year   | Accounting period for a company                        |
| Margin Profile   | Percentage-based pricing rule                          |
| Price List       | Collection of selling prices                           |
| Quick Customer   | Temporary customer created during billing              |
| Walk-in Customer | Cash customer without a master record                  |
| Trading Product  | Purchased and sold without manufacturing               |
| Formula Product  | Future product type for recipe-based manufacturing     |
| Engine           | Shared business logic service used across modules      |
| Offline First    | All core functionality works without internet access   |
