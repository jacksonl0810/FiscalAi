# FiscalAI Backend

Node.js backend API for the FiscalAI Brazilian tax invoice management application.

## 🚀 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: express-validator

## 📋 Prerequisites

- Node.js v18 or higher
- PostgreSQL database
- npm or yarn

## 🛠️ Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set your database URL and other settings:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/fiscalai"
   JWT_SECRET="your-secret-key"
   ```

3. **Set up database:**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database (creates tables)
   npm run db:push
   
   # (Optional) Seed with demo data
   npm run db:seed
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

   Server will be available at `http://localhost:3000`

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.js            # Demo data seeder
├── src/
│   ├── index.js           # App entry point
│   ├── middleware/
│   │   ├── auth.js        # JWT authentication
│   │   └── errorHandler.js # Error handling
│   └── routes/
│       ├── auth.js        # Authentication routes
│       ├── companies.js   # Company management
│       ├── invoices.js    # Invoice operations
│       ├── notifications.js # Notifications
│       ├── settings.js    # User settings
│       ├── taxes.js       # DAS/tax management
│       └── assistant.js   # AI assistant
├── .env                   # Environment variables
├── .env.example           # Environment template
└── package.json
```

## 🔧 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run migrations
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run db:seed` - Seed database with demo data

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| POST | /api/auth/refresh | Refresh token |
| GET | /api/auth/me | Get current user |
| PUT | /api/auth/profile | Update profile |
| POST | /api/auth/change-password | Change password |

### Companies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/companies | List companies |
| POST | /api/companies | Create company |
| GET | /api/companies/:id | Get company |
| PUT | /api/companies/:id | Update company |
| DELETE | /api/companies/:id | Delete company |
| POST | /api/companies/:id/register-fiscal | Register in Nuvem Fiscal |
| GET | /api/companies/:id/fiscal-status | Get fiscal status |
| POST | /api/companies/:id/check-fiscal-connection | Check connection |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/invoices | List invoices |
| POST | /api/invoices | Create invoice |
| GET | /api/invoices/:id | Get invoice |
| PUT | /api/invoices/:id | Update invoice |
| DELETE | /api/invoices/:id | Delete invoice |
| POST | /api/invoices/issue | Issue invoice |
| POST | /api/invoices/:id/check-status | Check status |
| POST | /api/invoices/:id/cancel | Cancel invoice |
| GET | /api/invoices/:id/pdf | Download PDF |
| GET | /api/invoices/:id/xml | Download XML |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/notifications | List notifications |
| POST | /api/notifications | Create notification |
| PUT | /api/notifications/:id | Update notification |
| DELETE | /api/notifications/:id | Delete notification |
| POST | /api/notifications/mark-all-read | Mark all as read |
| GET | /api/notifications/unread-count | Get unread count |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/settings | Get settings |
| PUT | /api/settings | Update settings |
| PATCH | /api/settings | Partial update |

### Taxes (DAS)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/taxes/das | List DAS payments |
| GET | /api/taxes/das/:id | Get DAS |
| POST | /api/taxes/das/:id/pay | Mark as paid |
| POST | /api/taxes/das/generate | Generate DAS |
| GET | /api/taxes/das/:id/pdf | Download PDF |
| GET | /api/taxes/summary/:companyId | Get summary |

### AI Assistant
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/assistant/process | Process command |
| GET | /api/assistant/suggestions | Get suggestions |

### Subscriptions (Pagar.me)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/subscriptions/create-customer | Create Pagar.me customer |
| POST | /api/subscriptions/create-plan | Create subscription plan |
| POST | /api/subscriptions/create | Create subscription |
| GET | /api/subscriptions/current | Get current subscription |
| POST | /api/subscriptions/cancel | Cancel subscription |
| POST | /api/subscriptions/webhook | Pagar.me webhook endpoint |

## 🔐 Authentication

All endpoints except `/api/auth/login`, `/api/auth/register`, and `/api/health` require authentication.

Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-token>
```

## 🌱 Demo Data

After running the seed script, you can login with:
- **Email**: demo@fiscalai.com
- **Password**: demo123

## 📝 Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### Required Variables

| Variable | Description | How to Get |
|----------|-------------|------------|
| `DATABASE_URL` | PostgreSQL connection string | Your database provider |
| `JWT_SECRET` | JWT signing secret | Generate with: `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | Refresh token secret | Generate with: `openssl rand -base64 32` |
| `NUVEM_FISCAL_CLIENT_ID` | Nuvem Fiscal OAuth Client ID | [Nuvem Fiscal Dashboard](https://dev.nuvemfiscal.com.br/) |
| `NUVEM_FISCAL_CLIENT_SECRET` | Nuvem Fiscal OAuth Client Secret | [Nuvem Fiscal Dashboard](https://dev.nuvemfiscal.com.br/) |
| `PAGARME_API_KEY` | Pagar.me API Key | [Pagar.me Dashboard](https://dashboard.pagar.me/) |
| `PAGARME_WEBHOOK_SECRET` | Pagar.me Webhook Secret | [Pagar.me Dashboard](https://dashboard.pagar.me/) |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | http://localhost:5173 |
| `JWT_EXPIRES_IN` | Token expiry | 15m |
| `JWT_REFRESH_EXPIRES_IN` | Refresh expiry | 7d |
| `OPENAI_API_KEY` | OpenAI API key | Optional (fallback to pattern matching) |
| `OPENAI_MODEL` | OpenAI model to use | gpt-4o-mini |
| `NUVEM_FISCAL_ENVIRONMENT` | Environment: 'sandbox' or 'production' | sandbox |
| `NUVEM_FISCAL_BASE_URL` | Production API base URL | https://api.nuvemfiscal.com.br/v2 |
| `NUVEM_FISCAL_SANDBOX_URL` | Sandbox API base URL | https://sandbox.nuvemfiscal.com.br/v2 |
| `PAGARME_ENCRYPTION_KEY` | Pagar.me Encryption Key | Optional, for card encryption |
| `PAGARME_ENVIRONMENT` | Environment: 'sandbox' or 'production' | sandbox |

See `.env.example` for a complete template with all variables.

## 🚀 Deployment

1. Set environment variables for production
2. Run `npm run db:push` to create tables
3. Run `npm start` to start the server

For production, use a process manager like PM2:
```bash
npm install -g pm2
pm2 start src/index.js --name fiscalai-api
```

## 📄 License

MIT
