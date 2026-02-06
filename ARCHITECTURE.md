# FiscalAI Architecture

## Overview

FiscalAI follows a **Clean Architecture** pattern with clear separation of concerns, making it maintainable, testable, and scalable.

## Project Structure

```
FiscalAI/
├── backend/                 # Node.js/Express Backend
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── constants/      # Application constants
│   │   ├── controllers/    # Request handlers (thin layer)
│   │   ├── lib/            # Core libraries (Prisma, etc.)
│   │   ├── middleware/     # Express middleware
│   │   ├── repositories/    # Data access layer
│   │   ├── routes/         # API route definitions
│   │   ├── services/       # Business logic layer
│   │   ├── utils/          # Utility functions
│   │   ├── validators/     # Validation schemas
│   │   ├── workers/        # Background workers
│   │   └── index.js        # Application entry point
│   ├── prisma/             # Database schema and migrations
│   ├── tests/              # Test files
│   └── scripts/            # Utility scripts
│
└── frontend/               # React/Vite Frontend
    ├── src/
    │   ├── api/            # API client and services
    │   ├── components/     # Reusable UI components
    │   │   ├── chat/       # Chat-related components
    │   │   ├── dashboard/  # Dashboard components
    │   │   ├── invoice/    # Invoice components
    │   │   ├── layout/     # Layout components
    │   │   └── ui/         # Base UI components
    │   ├── constants/      # Frontend constants
    │   ├── features/       # Feature-based modules (future)
    │   ├── hooks/          # Custom React hooks
    │   ├── lib/            # Core libraries (Auth, i18n, etc.)
    │   ├── pages/          # Page components
    │   ├── services/       # Frontend services
    │   ├── types/          # TypeScript types
    │   ├── utils/          # Utility functions
    │   ├── App.jsx         # Root component
    │   └── main.jsx        # Entry point
    └── public/             # Static assets
```

## Backend Architecture

### Layer Structure

```
┌─────────────────────────────────────┐
│         Routes (API Layer)          │  ← HTTP endpoints
├─────────────────────────────────────┤
│         Controllers                 │  ← Request/Response handling
├─────────────────────────────────────┤
│         Services                    │  ← Business logic
├─────────────────────────────────────┤
│         Repositories                 │  ← Data access
├─────────────────────────────────────┤
│         Database (Prisma)            │  ← Database layer
└─────────────────────────────────────┘
```

### Components

#### 1. **Routes** (`src/routes/`)
- Define API endpoints
- Apply middleware (auth, validation, rate limiting)
- Delegate to controllers
- **Example**: `companies.js`, `invoices.js`

#### 2. **Controllers** (`src/controllers/`)
- Handle HTTP requests/responses
- Validate input (using validators)
- Call services
- Format responses
- **Thin layer** - minimal logic

#### 3. **Services** (`src/services/`)
- Contain business logic
- Orchestrate multiple repositories
- Handle external API calls
- **Example**: `nuvemFiscal.js`, `invoiceService.js`

#### 4. **Repositories** (`src/repositories/`)
- Data access layer
- Abstract database operations
- Use Prisma for queries
- **Example**: `CompanyRepository.js`, `ClientRepository.js`

#### 5. **Validators** (`src/validators/`)
- Input validation schemas
- Use express-validator
- Reusable validation rules

#### 6. **Constants** (`src/constants/`)
- Application-wide constants
- HTTP status codes
- Error codes
- Configuration values

#### 7. **Middleware** (`src/middleware/`)
- Authentication
- Error handling
- Rate limiting
- Request logging

## Frontend Architecture

### Component Structure

```
┌─────────────────────────────────────┐
│         Pages                        │  ← Route components
├─────────────────────────────────────┤
│         Components                   │  ← Reusable UI
│         ├── Feature Components       │
│         └── Base UI Components      │
├─────────────────────────────────────┤
│         Services                    │  ← API calls, business logic
├─────────────────────────────────────┤
│         Hooks                       │  ← Custom React hooks
├─────────────────────────────────────┤
│         Utils                       │  ← Helper functions
└─────────────────────────────────────┘
```

### Key Patterns

#### 1. **API Client** (`src/api/`)
- Centralized API configuration
- Request/response interceptors
- Error handling

#### 2. **React Query** (`src/lib/query-client.js`)
- Server state management
- Caching and synchronization
- Optimistic updates

#### 3. **Constants** (`src/constants/`)
- API endpoints
- Route paths
- Query keys
- Configuration values

#### 4. **Utils** (`src/utils/`)
- Formatting functions
- Validation helpers
- Common utilities

## Design Principles

### 1. **Separation of Concerns**
- Each layer has a single responsibility
- Business logic separated from data access
- UI separated from business logic

### 2. **Dependency Inversion**
- High-level modules don't depend on low-level modules
- Both depend on abstractions
- Repositories abstract database access

### 3. **DRY (Don't Repeat Yourself)**
- Reusable components and utilities
- Shared constants and validators
- Base classes for common functionality

### 4. **Single Responsibility**
- Each class/function has one reason to change
- Controllers handle HTTP, services handle business logic
- Repositories handle data access

### 5. **Open/Closed Principle**
- Open for extension, closed for modification
- Base classes allow extension
- Interfaces allow implementation changes

## Data Flow

### Backend Request Flow

```
1. HTTP Request
   ↓
2. Route Handler (with middleware)
   ↓
3. Controller (validates, formats)
   ↓
4. Service (business logic)
   ↓
5. Repository (data access)
   ↓
6. Database (Prisma)
   ↓
7. Response (formatted by controller)
```

### Frontend Data Flow

```
1. User Action
   ↓
2. Component Event Handler
   ↓
3. Service/API Call
   ↓
4. React Query Mutation/Query
   ↓
5. API Client
   ↓
6. Backend API
   ↓
7. State Update (React Query)
   ↓
8. Component Re-render
```

## Testing Strategy

### Backend
- **Unit Tests**: Services, repositories, utilities
- **Integration Tests**: API endpoints
- **Test Location**: `backend/tests/`

### Frontend
- **Component Tests**: UI components
- **Integration Tests**: Feature workflows
- **E2E Tests**: Critical user paths

## Security

### Backend
- JWT authentication
- Rate limiting
- Input validation
- SQL injection prevention (Prisma)
- CORS configuration

### Frontend
- Token storage (httpOnly cookies preferred)
- XSS prevention (React escapes by default)
- CSRF protection
- Input sanitization

## Performance

### Backend
- Database indexing
- Query optimization
- Caching strategies
- Connection pooling

### Frontend
- Code splitting
- Lazy loading
- React Query caching
- Image optimization

## Scalability

### Horizontal Scaling
- Stateless API design
- Database connection pooling
- Load balancer ready

### Vertical Scaling
- Efficient queries
- Caching layer
- Background job processing

## Future Improvements

1. **Feature-based Frontend Structure**
   - Organize by domain (companies, invoices, taxes)
   - Better code splitting
   - Easier maintenance

2. **Event-Driven Architecture**
   - Event bus for decoupled services
   - Async processing
   - Better scalability

3. **Microservices** (if needed)
   - Separate services for different domains
   - Independent scaling
   - Technology diversity

4. **GraphQL API** (optional)
   - More flexible queries
   - Reduced over-fetching
   - Better frontend integration

## Best Practices

1. **Always use TypeScript/Type hints**
2. **Validate all inputs**
3. **Handle errors gracefully**
4. **Log important events**
5. **Write tests for critical paths**
6. **Document complex logic**
7. **Follow naming conventions**
8. **Keep functions small and focused**
9. **Use constants for magic values**
10. **Review code before merging**

## Contributing

When adding new features:

1. **Backend**: Follow the layer structure (Route → Controller → Service → Repository)
2. **Frontend**: Create reusable components, use constants, follow patterns
3. **Documentation**: Update this file and add code comments
4. **Testing**: Add tests for new functionality
5. **Review**: Ensure code follows architecture principles
