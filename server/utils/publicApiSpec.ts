import type { ApiKeyScope } from '../../app/types/api-key'
import { API_KEY_SCOPES } from '../../app/types/api-key'

/**
 * Hand-written OpenAPI 3.1 document for the APIs other systems call — the ERP Export API (API-key
 * auth) and public ticket submission. Rendered by Scalar at /docs (see nuxt.config.ts `scalar`).
 * Internal, session-only routes are deliberately left out; they're listed (dev only) at
 * /docs/internal from Nitro's auto-generated spec.
 *
 * Keep this in step with: server/api/integrations/export/*.get.ts, server/api/tickets/index.post.ts,
 * server/api/tickets/attachments.post.ts.
 */

const errorResponse = (statusCode: number, description: string, statusMessage: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
      example: { statusCode, statusMessage },
    },
  },
})

const EXPORT_ERRORS = {
  401: errorResponse(401, 'Unauthorized. The Authorization header is missing, or the key is invalid, revoked or deleted.', 'Invalid or revoked API key'),
  403: errorResponse(403, 'Forbidden. The key is valid but wasn\'t granted this resource.', 'This key does not have access to "clients"'),
  429: errorResponse(429, 'Too Many Requests. Over 300 requests/hour for this key.', 'Too many requests — please slow down.'),
}

const EXPORT_RESOURCES: Record<ApiKeyScope, { title: string, itemSchema: string, description: string }> = {
  clients: { title: 'Export clients', itemSchema: 'ExportClient', description: 'Every client with contact details, pipeline stage and estimated value, newest first.' },
  projects: { title: 'Export projects', itemSchema: 'ExportProject', description: 'Every project with its client, status and dates, newest first.' },
  products: { title: 'Export products', itemSchema: 'ExportProduct', description: 'The product/service catalogue used on quotes.' },
  tenders: { title: 'Export tenders', itemSchema: 'ExportTender', description: 'Every tender with issuing authority, stage, value and submission deadline, newest first. Internal notes are not included.' },
}

function exportPath(scope: ApiKeyScope) {
  const meta = EXPORT_RESOURCES[scope]
  return {
    get: {
      tags: ['ERP Export'],
      operationId: `export_${scope}`,
      summary: meta.title,
      description: `${meta.description}\n\nRequires an API key with the \`${scope}\` scope.`,
      security: [{ apiKey: [] }],
      responses: {
        200: {
          description: 'All records for this resource.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['resource', 'count', 'items'],
                properties: {
                  resource: { type: 'string', const: scope },
                  count: { type: 'integer', description: 'Number of items returned.' },
                  items: { type: 'array', items: { $ref: `#/components/schemas/${meta.itemSchema}` } },
                },
              },
            },
          },
        },
        ...EXPORT_ERRORS,
      },
    },
  }
}

const isoDateTime = { type: 'string', format: 'date-time' } as const
const isoDate = { type: 'string', format: 'date' } as const

export function buildPublicApiSpec(origin: string) {
  const exportPaths = Object.fromEntries(
    API_KEY_SCOPES.map(scope => [`/api/integrations/export/${scope.replace('_', '-')}`, exportPath(scope)]),
  )

  return {
    openapi: '3.1.0',
    info: {
      title: 'IBS Platform API',
      version: '1.0.0',
      description: [
        'Public APIs for systems that integrate with the IBS platform.',
        '',
        '- **ERP Export API**: read-only access to clients, projects, products and tenders, with an API key.',
        '- **Ticket Submission API**: create support tickets from your own website or contact form (no auth, CORS-enabled for configured origins).',
        '',
        '## Getting an API key',
        '1. An admin opens **Administration → Integrations → API Keys** and clicks **New Key**, choosing which resources it can reach.',
        '2. Copy the key immediately. It\'s shown once, and only its hash is stored.',
        '3. Send it as `Authorization: Bearer <key>` on every export request.',
        '',
        'Revoke a key there at any time. It returns `401` from then on.',
      ].join('\n'),
    },
    servers: [{ url: origin, description: 'This deployment' }],
    tags: [
      { name: 'ERP Export', description: 'Read-only data export. Each key only reaches the resources it was granted; each key is limited to 300 requests/hour.' },
      { name: 'Tickets', description: 'Public ticket submission, as used by the /portal page. Rate-limited per IP and per requester email.' },
    ],
    paths: {
      '/api/integrations/export': {
        get: {
          tags: ['ERP Export'],
          operationId: 'export_discover',
          summary: 'List the resources this key can reach',
          description: 'Self-discovery for a key: returns only the resources it was granted, with their paths. Works with any valid, non-revoked key.',
          security: [{ apiKey: [] }],
          responses: {
            200: {
              description: 'The resources this key can export.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      resources: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            scope: { type: 'string', enum: [...API_KEY_SCOPES] },
                            path: { type: 'string', example: '/api/integrations/export/clients' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: EXPORT_ERRORS[401],
          },
        },
      },
      ...exportPaths,
      '/api/tickets': {
        post: {
          tags: ['Tickets'],
          operationId: 'create_ticket',
          summary: 'Submit a support ticket',
          description: [
            'Creates a ticket. It\'s auto-assigned, gets SLA deadlines from its priority, and pages on-call staff.',
            '',
            'No authentication. For cross-origin calls (e.g. a contact form on your own site), the origin must be listed in `NUXT_PUBLIC_PORTAL_CORS_ORIGINS`.',
            '',
            'Limits: 5 tickets/hour per IP address and 5/hour per requester email.',
            '',
            'To attach files, upload each one to `POST /api/tickets/attachments` first and pass the returned objects in `attachments`.',
          ].join('\n'),
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NewTicket' },
                example: {
                  subject: 'Access control panel offline',
                  description: 'The access control panel at our east entrance has shown "offline" since this morning.',
                  requester: 'Ama Owusu',
                  requesterEmail: 'ama.owusu@example.com',
                  requesterPhone: '+233 24 123 4567',
                  category: 'Hardware',
                  priority: 'high',
                },
              },
            },
          },
          responses: {
            201: {
              description: 'The ticket was created.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ticket: { $ref: '#/components/schemas/Ticket' },
                      pagedCount: { type: 'integer', description: 'How many on-call staff were paged.' },
                    },
                  },
                },
              },
            },
            400: errorResponse(400, 'Bad Request. A required field is missing or invalid.', 'subject, description, requester, requesterEmail, category and priority are required'),
            429: errorResponse(429, 'Too Many Requests. Too many tickets from this IP or email in the last hour.', 'Too many tickets submitted recently. Please try again later.'),
          },
        },
      },
      '/api/tickets/attachments': {
        post: {
          tags: ['Tickets'],
          operationId: 'upload_ticket_attachment',
          summary: 'Upload a file to attach to a ticket',
          description: 'Upload one file (max 4 MB) before submitting the ticket, then include the returned `attachment` in `POST /api/tickets`. Allowed: PNG, JPEG, WEBP, GIF, PDF, TXT, CSV, Word, Excel, PowerPoint, ZIP. Limit: 20 uploads/hour per IP.',
          security: [],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: { file: { type: 'string', format: 'binary' } },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Uploaded.',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { attachment: { $ref: '#/components/schemas/TicketAttachment' } } },
                },
              },
            },
            400: errorResponse(400, 'Bad Request. No file, unsupported type, or larger than 4 MB.', 'That file type is not supported'),
            429: errorResponse(429, 'Too Many Requests. Too many uploads from this IP in the last hour.', 'Too many files uploaded recently. Please try again later.'),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        apiKey: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API key (erp_…)',
          description: 'An API key from Administration → Integrations → API Keys, sent as `Authorization: Bearer erp_…`.',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            statusCode: { type: 'integer' },
            statusMessage: { type: 'string' },
          },
        },
        ExportClient: {
          type: 'object',
          required: ['id', 'name', 'stage', 'createdAt', 'updatedAt'],
          properties: {
            id: { type: 'string', example: 'CL-12' },
            name: { type: 'string', example: 'Acme Ltd' },
            contactName: { type: 'string' },
            contactEmail: { type: 'string', format: 'email' },
            contactPhone: { type: 'string' },
            stage: { type: 'string', enum: ['lead', 'contacted', 'proposal', 'negotiation', 'active', 'lost'] },
            estimatedValue: { type: 'number' },
            createdAt: isoDateTime,
            updatedAt: isoDateTime,
          },
        },
        ExportProject: {
          type: 'object',
          required: ['id', 'name', 'clientId', 'status', 'createdAt', 'updatedAt'],
          properties: {
            id: { type: 'string', example: 'PROJECT-4' },
            name: { type: 'string' },
            description: { type: 'string' },
            clientId: { type: 'string' },
            clientName: { type: 'string' },
            status: { type: 'string', enum: ['planned', 'active', 'on_hold', 'completed', 'cancelled'] },
            startDate: isoDate,
            endDate: isoDate,
            createdAt: isoDateTime,
            updatedAt: isoDateTime,
          },
        },
        ExportProduct: {
          type: 'object',
          required: ['id', 'name', 'unitPrice', 'currency', 'createdAt', 'updatedAt'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            unitPrice: { type: 'number' },
            currency: { type: 'string', example: 'GHS' },
            createdAt: isoDateTime,
            updatedAt: isoDateTime,
          },
        },
        ExportTender: {
          type: 'object',
          required: ['id', 'title', 'stage', 'createdAt', 'updatedAt'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            issuingAuthority: { type: 'string' },
            referenceNumber: { type: 'string' },
            contactName: { type: 'string' },
            contactEmail: { type: 'string', format: 'email' },
            contactPhone: { type: 'string' },
            source: { type: 'string' },
            stage: { type: 'string', enum: ['identified', 'registered', 'preparing', 'submitted', 'evaluation', 'won', 'lost'] },
            estimatedValue: { type: 'number' },
            submissionDeadline: { type: 'string', description: 'Date or date-time the tender must be submitted by.' },
            convertedClientId: { type: 'string', description: 'Set once a won tender has been converted into a client.' },
            createdAt: isoDateTime,
            updatedAt: isoDateTime,
          },
        },
        TicketAttachment: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'panel-photo.jpg' },
            url: { type: 'string', format: 'uri', description: 'Must be a URL returned by POST /api/tickets/attachments; other URLs are dropped.' },
            type: { type: 'string', example: 'image/jpeg' },
            size: { type: 'integer', description: 'Bytes.' },
          },
        },
        NewTicket: {
          type: 'object',
          required: ['subject', 'description', 'requester', 'requesterEmail', 'category', 'priority'],
          properties: {
            subject: { type: 'string' },
            description: { type: 'string' },
            requester: { type: 'string', description: 'Requester\'s name.' },
            requesterEmail: { type: 'string', format: 'email', description: 'Ticket updates are emailed here.' },
            requesterPhone: { type: 'string', description: 'Optional. 7–15 digits; `+`, spaces, dashes, dots and brackets allowed.', example: '+233 24 123 4567' },
            category: { type: 'string', example: 'Hardware' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            referenceNumber: { type: 'string', description: 'Your own reference, e.g. an order or site number.' },
            attachments: { type: 'array', items: { $ref: '#/components/schemas/TicketAttachment' } },
          },
        },
        Ticket: {
          type: 'object',
          description: 'The created ticket.',
          properties: {
            id: { type: 'string', example: 'TICKET-1042' },
            subject: { type: 'string' },
            description: { type: 'string' },
            requester: { type: 'string' },
            requesterEmail: { type: 'string', format: 'email' },
            requesterPhone: { type: 'string' },
            category: { type: 'string' },
            status: { type: 'string', enum: ['open', 'in-progress', 'resolved', 'closed'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            referenceNumber: { type: 'string' },
            attachments: { type: 'array', items: { $ref: '#/components/schemas/TicketAttachment' } },
            assigneeName: { type: 'string' },
            dueAt: { ...isoDateTime, description: 'Resolution SLA deadline.' },
            firstResponseDueAt: { ...isoDateTime, description: 'First-response SLA deadline.' },
            createdAt: isoDateTime,
            updatedAt: isoDateTime,
          },
        },
      },
    },
  }
}
