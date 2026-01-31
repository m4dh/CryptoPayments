# Crypto Payment Library

## Overview

A cryptocurrency payment library that enables USDT/USDC payments on Arbitrum, Ethereum, and Tron networks. The system is designed as a native library that can be directly imported and integrated into applications without external API calls or authentication. It features real-time blockchain monitoring via Alchemy, secure webhook notifications, encrypted address storage, and a demo payment UI for testing.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- Refactored from multi-tenant microservice to native library architecture
- Removed API key authentication (no longer needed for native library)
- Simplified API endpoints for direct usage
- Updated documentation to reflect library-based integration
- Uses single "default" tenant internally for all operations

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
- **Authentication**: None required (native library approach)
- **Library**: `CryptoPaymentsLibrary` class for direct integration

### Data Storage
- **Primary Database**: PostgreSQL with Drizzle ORM
- **Schema Design**: Single tenant with "default" tenant ID
- **Core Tables**: tenants, plans, payments, subscriptions, webhook_logs
- **Encryption**: AES-256-GCM encryption for sensitive address data

### Payment Processing
- **Blockchain Monitoring**: Alchemy SDK for EVM chains (Arbitrum, Ethereum), TronGrid API for Tron
- **Payment Flow**: Initiate → Monitor → Confirm → Activate Subscription
- **Scheduled Jobs**: node-cron for payment expiration, subscription expiration, and webhook retries
- **Status Tracking**: pending → awaiting_confirmation → confirmed/expired/failed
- **Payment Timeout**: 30 minutes
- **Polling Interval**: 5 seconds

### Webhook System
- **Security**: HMAC-SHA256 signatures for payload verification
- **Delivery**: Automatic retries with exponential backoff
- **Events**: payment.created, payment.confirmed, payment.expired, subscription.activated, etc.

### Key Components
- **Library**: `server/lib/cryptoPayments.ts` - Main CryptoPaymentsLibrary class
- **Storage**: `server/storage.ts` - Database abstraction layer
- **Blockchain Monitor**: `server/services/blockchainMonitorService.ts` - Real-time transaction monitoring
- **Demo UI**: `client/src/pages/payment.tsx` - Payment flow demonstration

## API Endpoints

- `GET /api/plans` - List available subscription plans
- `GET /api/networks` - Get supported blockchain networks
- `POST /api/payments` - Initiate a new payment
- `POST /api/payments/:id/confirm` - Confirm payment was sent
- `GET /api/payments/:id/status` - Check payment status
- `GET /api/health` - Health check

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
- `qrcode`: QR code generation for wallet addresses
