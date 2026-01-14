# FiscalAI - Frontend

A modern React frontend for a Brazilian tax invoice management application. This frontend is designed to work with a Node.js + PostgreSQL backend.

## 🚀 Features

- **AI Assistant**: Natural language interface for invoice operations
- **Dashboard**: Revenue analytics, tax tracking, and MEI limit monitoring
- **Invoice Management**: Create, view, and manage NFS-e (Nota Fiscal de Serviço Eletrônica)
- **Company Setup**: Multi-company support with fiscal integration
- **Tax Management**: DAS (Documento de Arrecadação do Simples Nacional) tracking
- **Notifications**: Real-time alerts and updates
- **Modern UI**: Dark theme with glass-morphism design

## 📋 Prerequisites

- Node.js v18 or higher
- npm or yarn
- A running Node.js backend (see Backend Requirements section)

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd fiscalai-frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and set your backend API URL:
   ```env
   VITE_API_URL=http://localhost:3000/api
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`

## 📁 Project Structure

```
src/
├── api/
│   ├── client.ts           # Axios client with auth interceptors
│   └── services/           # API service modules
│       ├── auth.ts         # Authentication service
│       ├── companies.ts    # Company management
│       ├── invoices.ts     # Invoice operations
│       ├── notifications.ts # Notifications
│       ├── settings.ts     # User settings
│       ├── taxes.ts        # Tax/DAS management
│       └── assistant.ts    # AI assistant
├── components/             # React components
│   ├── chat/              # Chat/AI components
│   ├── dashboard/         # Dashboard components
│   ├── invoice/           # Invoice components
│   ├── layout/            # Layout components
│   └── ui/                # shadcn/ui components
├── lib/                   # Utilities and context
│   ├── AuthContext.jsx    # Authentication context
│   └── query-client.js    # React Query client
├── pages/                 # Page components
├── types/                 # TypeScript type definitions
└── utils/                 # Utility functions
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run typecheck` - Run TypeScript type checking

## 🔌 Backend API Requirements

Your Node.js backend should implement the following API endpoints:

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### Companies
- `GET /api/companies` - List user's companies
- `POST /api/companies` - Create company
- `GET /api/companies/:id` - Get company
- `PUT /api/companies/:id` - Update company
- `DELETE /api/companies/:id` - Delete company
- `POST /api/companies/:id/register-fiscal` - Register in fiscal cloud
- `GET /api/companies/:id/fiscal-status` - Get fiscal status
- `POST /api/companies/:id/check-fiscal-connection` - Check fiscal connection

### Invoices
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/:id` - Get invoice
- `PUT /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete invoice
- `POST /api/invoices/issue` - Issue invoice to fiscal authority
- `POST /api/invoices/:id/check-status` - Check invoice status
- `POST /api/invoices/:id/cancel` - Cancel invoice
- `GET /api/invoices/:id/pdf` - Download PDF
- `GET /api/invoices/:id/xml` - Download XML

### Notifications
- `GET /api/notifications` - List notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/:id` - Update notification
- `DELETE /api/notifications/:id` - Delete notification
- `POST /api/notifications/mark-all-read` - Mark all as read

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Save settings
- `PATCH /api/settings` - Update specific settings

### Taxes (DAS)
- `GET /api/taxes/das` - List DAS payments
- `GET /api/taxes/das/:id` - Get DAS
- `POST /api/taxes/das/:id/pay` - Mark as paid
- `GET /api/taxes/das/:id/pdf` - Download PDF

### AI Assistant
- `POST /api/assistant/process` - Process AI command
- `GET /api/assistant/suggestions` - Get suggestions
- `POST /api/assistant/transcribe` - Transcribe audio

## 🗄️ Database Schema (PostgreSQL)

See `BACKEND_API.md` for detailed database schema and API specifications.

## 🔐 Authentication

The frontend uses JWT-based authentication:
- Access tokens are stored in localStorage
- Automatic token refresh on 401 responses
- Protected routes redirect to login when unauthenticated

## 🎨 UI Components

Built with:
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Framer Motion](https://www.framer.com/motion/) - Animations
- [Lucide Icons](https://lucide.dev/) - Icons
- [Recharts](https://recharts.org/) - Charts

## 📝 License

MIT License - see LICENSE file for details.
