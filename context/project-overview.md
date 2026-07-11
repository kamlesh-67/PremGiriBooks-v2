# Premgiri Books ERP

## Overview

Premgiri Books ERP is a modern, modular, business management system developed specifically for Indian businesses. It provides an integrated platform for Accounting, GST, Inventory, Sales, Purchase, Pricing, Employee Management, and Financial Reporting.

The application follows a voucher-driven and document-driven architecture where every business transaction automatically generates accounting vouchers, inventory movements, GST records, and complete audit trails.

Although initially developed for **Premgiri Books**, the architecture is designed as a generic ERP platform that can support retailers, wholesalers, distributors, publishers, bookstores, manufacturers, and service businesses with minimal customization.

The system is designed to be scalable from a single retail store to multi-branch enterprises while remaining easy to extend .

---

## Goals

1. Provide complete double-entry accounting.
2. Manage GST-compliant sales and purchase transactions.
3. Manage inventory across multiple warehouses.
4. Generate financial statements automatically.
5. Support multiple companies and financial years.
6. Provide fast billing with barcode support.
7. Support retail, wholesale, dealer, and distributor pricing.
8. Generate GSTR-1, GSTR-3B, and GST reports.
9. Maintain complete audit trails through voucher-based accounting.
10. Build an AI-friendly modular architecture for future expansion.

---

## Core User Flow

1. User signs in.
2. User selects a company.
3. User selects the financial year.
4. User enters the dashboard.
5. User manages master data.
6. User creates business transactions.
7. System validates pricing, inventory, and GST.
8. Voucher Engine generates accounting entries.
9. Inventory Engine updates stock.
10. GST Engine updates GST registers.
11. Reporting Engine updates financial and operational reports.
12. User reviews, prints, exports, or shares reports.

---

## Features

### Authentication & Company Management

- User authentication
- Company creation
- Multi-company support
- Multi-branch support
- Financial year management
- Role-based access control
- Audit logging

---

### Dashboard

- Business summary
- Sales overview
- Purchase overview
- Cash and Bank balances
- Receivables
- Payables
- Low stock alerts
- GST summary
- Business analytics

---

### Master Management

- Customers
- Suppliers
- Products
- Categories
- Brands
- Units
- Warehouses
- Branches
- Employees
- GST Rates
- HSN Codes
- Banks
- Ledger Groups
- Margin Profiles
- Price Lists
- Expense Heads
- Income Heads

---

### Customer Management

Supports three customer types.

#### Permanent Customer

- Full customer master
- Ledger creation
- Outstanding tracking
- Statements
- Credit limits

#### Quick Customer

- Created directly during billing
- Name
- Mobile Number
- Address
- GSTIN
- Email
- Optional conversion into permanent customer

#### Walk-in Customer

- Cash customer
- No customer master
- Fast billing
- Optional details

---

### Pricing Engine

- Margin Profiles
- Price Lists
- Customer-specific pricing
- Quantity pricing
- Promotional pricing
- Retail pricing
- Wholesale pricing
- Dealer pricing
- Distributor pricing
- Automatic selling price generation
- Margin or Markup calculation modes
- Manual price override with permissions
- Selling below cost warnings

---

### Sales Management

- Quotations
- Sales Orders
- Delivery Challans
- Sales Invoices
- Credit Notes
- Debit Notes
- Sales Returns
- Barcode billing
- Multiple payment methods
- Invoice printing
- PDF generation
- WhatsApp sharing

---

### Purchase Management

- Purchase Orders
- Goods Receipt Notes
- Purchase Invoices
- Purchase Returns
- Supplier outstanding management

---

### Inventory Management

- Opening stock
- Stock movement
- Warehouse management
- Stock transfer
- Stock adjustment
- Physical verification
- Batch tracking
- Serial number tracking
- Reorder levels
- Stock valuation

---

### Accounting

Voucher-based accounting including:

- Payment Voucher
- Receipt Voucher
- Contra Voucher
- Journal Voucher
- Sales Voucher
- Purchase Voucher
- Credit Notes
- Debit Notes

Financial reports generated automatically.

---

### GST

- GST calculation
- CGST
- SGST
- IGST
- CESS
- Reverse Charge
- HSN Summary
- GSTR-1
- GSTR-3B
- GST Registers

---

### Employee Management

- Employee Master
- Attendance
- Salary
- Payroll
- Departments
- Designations

---

### Reports

Financial Reports

- Trial Balance
- Profit & Loss
- Balance Sheet
- Cash Flow

Operational Reports

- Sales Reports
- Purchase Reports
- Stock Reports
- Customer Reports
- Supplier Reports
- Employee Reports
- GST Reports

---

## Scope

### In Scope

- User authentication
- Company management
- Financial year management
- Customer management
- Supplier management
- Product management
- Pricing engine
- Margin profiles
- Inventory management
- Purchase management
- Sales management
- Voucher engine
- Accounting
- GST compliance
- Financial reports
- Employee management
- Dashboard analytics
- Excel import/export
- PDF generation
- Barcode billing
- Audit logging

---

### Out Of Scope (Initial Release)

- Manufacturing (BOM)
- Formula / Recipe Management
- Automotive Paint Mixing
- Production Orders
- Batch Manufacturing
- Raw Material Consumption
- Production Costing
- Production Wastage Tracking
- Formula Versioning
- Vehicle & Color Formula Library
- CRM
- Service Management
- POS Hardware Integrations
- Mobile Applications
- Banking API Integration
- GST Portal Auto Filing
- E-Invoice Integration
- E-Way Bill Integration
- AI Business Analytics
- Multi-Currency Accounting

---

## Success Criteria

1. A business can complete company setup within minutes.
2. Sales and purchase invoices automatically generate vouchers.
3. Inventory updates automatically after every stock transaction.
4. Financial statements are generated from voucher data without manual adjustments.
5. GST reports are generated accurately for filing.
6. Customer pricing is calculated automatically using the Pricing Engine.
7. Quick customers can be billed without creating master records.
8. Permanent customers maintain complete ledgers and outstanding balances.
9. Reports remain accurate across multiple branches and financial years.
10. The architecture remains modular, AI-friendly, and extensible for future ERP modules.
