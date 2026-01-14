# API Response Format Standardization

All API endpoints now return responses in a standardized format.

## Standard Format

### Success Response

```json
{
  "status": "success",
  "message": "Operation completed successfully",
  "data": { ... }  // Optional, contains response data
}
```

### Error Response

```json
{
  "status": "error",
  "message": "Error description",
  "code": "ERROR_CODE",  // Optional error code
  "errors": [...]  // Optional, for validation errors
}
```

## Examples

### Success with Data

```json
{
  "status": "success",
  "message": "Nota fiscal emitida com sucesso",
  "data": {
    "invoice": {
      "id": "123",
      "numero": "NFS001",
      "status": "autorizada"
    }
  }
}
```

### Success without Data

```json
{
  "status": "success",
  "message": "Company deleted successfully"
}
```

### Error Response

```json
{
  "status": "error",
  "message": "Falha ao emitir nota fiscal na Nuvem Fiscal",
  "code": "INVOICE_EMISSION_ERROR"
}
```

### Validation Error

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Valid email is required"
    }
  ]
}
```

## Implementation

### Using Helper Functions

```javascript
import { sendSuccess, sendError } from '../utils/response.js';

// Success response
sendSuccess(res, 'Operation completed', { data: ... }, 201);

// Error response
sendError(res, 'Operation failed', { details: ... }, 400);
```

### Direct Format

```javascript
// Success
res.json({
  status: 'success',
  message: 'Operation completed',
  data: { ... }
});

// Error
res.status(400).json({
  status: 'error',
  message: 'Operation failed',
  code: 'ERROR_CODE'
});
```

## Updated Routes

All routes have been updated to use the standardized format:

- ✅ `/api/companies/*` - Company operations
- ✅ `/api/invoices/*` - Invoice operations  
- ✅ `/api/taxes/*` - Tax operations
- ✅ `/api/notifications/*` - Notification operations
- ✅ `/api/settings/*` - Settings operations
- ✅ `/api/assistant/*` - AI assistant operations
- ✅ Error handler middleware

## HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `404` - Not Found
- `409` - Conflict (duplicate)
- `500` - Internal Server Error
- `501` - Not Implemented

The `status` field in the JSON response indicates success/error, while HTTP status code provides additional context.
