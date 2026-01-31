# Crypto Payment Microservice

## Overview

A standalone cryptocurrency payment microservice that enables USDT/USDC payments on Arbitrum, Ethereum, and Tron networks. The system is designed as an independent REST API with multi-tenant architecture, allowing multiple applications to integrate crypto payments through API key authentication. It includes a TypeScript SDK for easy client integration, real-time blockchain monitoring, and secure webhook notifications.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight routing)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **API Design**: RESTful endpoints under `/api` prefix
- **Authentication**: API key-based authentication with Bearer tokens
- **Rate Limiting**: Custom in-memory rate limiter with tenant-scoped limits

### Data Storage
- **Primary Database**: PostgreSQL with Drizzle ORM
- **Schema Design**: Multi-tenant with tenant isolation via `tenantId` foreign keys
- **Core Tables**: tenants, plans, payments, subscriptions, webhook_logs
- **Encryption**: AES-256-GCM encryption for sensitive address data

### Payment Processing
- **Blockchain Monitoring**: Alchemy SDK for EVM chains (Arbitrum, Ethereum), TronGrid API for Tron
- **Payment Flow**: Initiate → Monitor → Confirm → Activate Subscription
- **Scheduled Jobs**: node-cron for payment expiration, subscription expiration, and webhook retries
- **Status Tracking**: pending → awaiting_confirmation → confirmed/expired/failed

### Webhook System
- **Security**: HMAC-SHA256 signatures for payload verification
- **Delivery**: Automatic retries with exponential backoff
- **Events**: payment.created, payment.confirmed, payment.expired, subscription.activated, etc.

### SDK
- **Location**: `/sdk` directory as a separate npm package
- **Features**: Full TypeScript types, payment initiation, status polling, webhook verification
- **Target**: CommonJS output for broad compatibility

## External Dependencies

### Blockchain Services
- **Alchemy SDK**: EVM blockchain monitoring (Arbitrum, Ethereum) - requires `ALCHEMY_API_KEY`
- **TronGrid API**: Tron blockchain monitoring - optional `TRONGRID_API_KEY`

### Database
- **PostgreSQL**: Primary data store - requires `DATABASE_URL` environment variable
- **Drizzle Kit**: Database migrations via `db:push` command

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Used for encryption key derivation
- `ALCHEMY_API_KEY`: For EVM blockchain monitoring
- `TRONGRID_API_KEY`: Optional, for Tron monitoring
- `PAYMENT_ADDRESS_EVM`: Default EVM receiving address
- `PAYMENT_ADDRESS_TRON`: Default Tron receiving address

### Key NPM Packages
- `alchemy-sdk`: Blockchain data and monitoring
- `drizzle-orm` / `drizzle-kit`: Database ORM and migrations
- `node-cron`: Scheduled background jobs
- `zod`: Request validation
- `@tanstack/react-query`: Client-side data fetching