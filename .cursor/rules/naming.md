---
description: Strict cross-stack naming conventions enforcement for all layers (Code, File, DB, Cache, Search, API, Git, Infra). Prevents mixed casing and non-standard ecosystem patterns.
globs: "**/*.{ts,tsx,js,jsx,py,json,yaml,yml,sql,dbml,md}"
alwaysApply: true
---

# SYSTEM INSTRUCTIONS FOR AI AGENTS (Cursor / Claude)

- You MUST strictly enforce the NAMING RULES defined below for all file creations, code generations, architectural designs, and refactoring tasks.
- Act as a strict gatekeeper: validate the target layer's casing before generating code or creating new files.
- If existing code violates these rules, do not propagate the bad pattern—flag it or fix it based on context.

---

# NAMING RULES (CROSS-STACK)

## Core Principle

- Naming depends on context, responsibility, and language convention.
- Prefer ecosystem conventions over personal preference.
- Never mix naming conventions within the same layer.

---

# Code Layer

## Classes

Use **PascalCase**.
Examples:

\`\`\`ts
UserService;
AuthController;
\`\`\`

## Interfaces

Use **PascalCase**. Do not use Hungarian prefixes (e.g., \`I\`).
Examples:

\`\`\`TypeScript
UserProfile
AuthContext
\`\`\`

_Prohibited:_ \`IUserProfile\`, \`IAuthContext\` (unless explicitly required by an inherited legacy codebase).

## Types

Use **PascalCase**.
Examples:

\`\`\`TypeScript
UserRole
ApiResponse
\`\`\`

## Enums

Use **PascalCase** for the Enum name, and **UPPER_SNAKE_CASE** for its members.
Examples:

\`\`\`TypeScript
enum UserStatus {
ACTIVE,
INACTIVE,
PENDING
}
\`\`\`

## Functions

Use **camelCase**.
Examples:

\`\`\`TypeScript
getUser()
createOrder()
validateToken()
\`\`\`

## Variables

Use **camelCase**.
Examples:

\`\`\`TypeScript
userProfile
orderCount
tenantId
\`\`\`

## Booleans

Use **camelCase** with strict semantic prefixes.
Allowed prefixes: \`is\`, \`has\`, \`can\`, \`should\`.
Examples:

\`\`\`TypeScript
isActive
hasPermission
canEdit
shouldRefresh
\`\`\`

## Constants

Use **UPPER_SNAKE_CASE**.
Examples:

\`\`\`TypeScript
MAX_RETRY_COUNT
API_TIMEOUT
DEFAULT_PAGE_SIZE
\`\`\`

## Acronyms

Treat acronyms as normal words to ensure readability and automated parsing.

- **Good:** \`userId\`, \`apiClient\`, \`jwtToken\`, \`htmlParser\`
- **Bad:** \`userID\`, \`APIClient\`, \`JWTToken\`, \`HTMLParser\`

# File & Folder Layer

## General Rule

Follow language ecosystem conventions strictly. **Within TS/JS, there are two distinct sub-rules — see below. This is intentional, not inconsistency.**

### TypeScript / JavaScript / React

There are **two file naming patterns**, depending on whether the file carries an architectural-layer suffix (see \`File Suffixes\` section):

1. **Plain files (no architectural suffix)** — components, hooks, utils, generic modules → **kebab-case**.
   Examples:
   \`\`\`
   user-profile.tsx
   login-form.tsx
   date-utils.ts
   app-router.ts
   \`\`\`

2. **Files with an architectural suffix (NestJS ecosystem convention)** — service, controller, module, dto, guard, etc. → **dot-notation**, matching the NestJS CLI / Angular-style convention. This takes precedence over the plain kebab-case rule whenever a suffix from the \`File Suffixes\` list is used.
   Examples:
   \`\`\`
   user.service.ts
   auth.controller.ts
   tenant.dto.ts
   jwt.guard.ts
   user.repository.ts
   \`\`\`

    ❌ Do NOT use \`user-service.ts\`, \`auth-controller.ts\` — dash-separated suffixes are prohibited once a recognized architectural suffix is used. The base entity name before the suffix should still be kebab-case if multi-word: \`tenant-permission.dto.ts\`, \`refresh-token.guard.ts\`.

### Python

Use **snake_case**.
Examples:

\`\`\`
user_service.py
auth_controller.py
\`\`\`

### Java / C#

Match the Class name exactly (**PascalCase**).
Examples:

\`\`\`
UserService.java
AuthController.cs
\`\`\`

### Go

Use short, concise **lowercase** names (single word preferred).
Examples:

\`\`\`
user.go
service.go
repo.go
\`\`\`

# React / Next.js Naming

## Components

Use **PascalCase** for the component name inside the file. File name follows the plain-file rule (**kebab-case**, no architectural suffix applies to components).

- File: \`user-profile.tsx\`, \`login-form.tsx\`
- Component definition: \`const UserProfile = () => {}\`

## Hooks

Must start with \`use\` using **kebab-case** for file names and **camelCase** for the function.

- File: \`use-auth.ts\`, \`use-tenant-permission.ts\`
- Function: \`const useAuth = () => {}\`

## Context & Providers

- File: \`auth.context.tsx\` -> Component: \`AuthContext\`
- File: \`auth.provider.tsx\` -> Component: \`AuthProvider\`

# File Suffixes

Use suffixes only when they provide critical architectural meaning for navigation and layering. **When any of these suffixes is used, the file MUST use dot-notation as defined in \`File & Folder Layer > TypeScript/JavaScript/React\` above — never dash-notation.**

\`\`\`

# Logic & Architecture

_.service.ts
_.repository.ts
_.controller.ts
_.middleware.ts
_.guard.ts
_.validator.ts
_.mapper.ts
_.module.ts

# Data & Config

_.dto.ts
_.types.ts
_.constants.ts
_.schema.ts
_.config.ts
_.utils.ts

# React Specific

_.hook.ts
_.context.tsx
\*.provider.tsx
\`\`\`

Examples:

\`\`\`
user.service.ts
auth.repository.ts
tenant.dto.ts
user.types.ts
api.constants.ts
\`\`\`

# API Layer

## REST Endpoints

Use **kebab-case** and plural nouns for resources.
Examples:

\`\`\`HTTP
GET /user-profiles
POST /auth/login
GET /tenants/123/permissions
\`\`\`

## Query Parameters

Use **camelCase**.
Examples:

\`\`\`HTTP
?pageSize=20
?tenantId=123
\`\`\`

## JSON Fields (Request/Response)

Use **camelCase**.
Examples:

\`\`\`JSON
{
"userId": "123",
"fullName": "John Doe",
"isActive": true
}
\`\`\`

# Database Layer

Naming differs by database ecosystem. **Do not cross-apply SQL conventions to MongoDB or vice versa — each block below applies only to its own database.**

## Relational Database (PostgreSQL / SQL — via DBML, TypeORM, Prisma-SQL)

### Tables

Use **snake_case** and **plural (số nhiều)** form.
Examples:

\`\`\`SQL
user_profiles
tenant_permissions
orders
\`\`\`

### Columns

Use **snake_case** and **singular (số ít)** form.
Examples:

\`\`\`SQL
id
created_at
updated_at
tenant_id
\`\`\`

### Primary Keys

Use \`id\` or \`<entity_singular>\_id\` consistently across the project.
Examples: \`id\` or \`user_profile_id\`.

### Foreign Keys

Use \`<entity_singular>\_id\`.
Examples: \`user_id\`, \`tenant_id\`, \`role_id\`.

### Constraints & Indexes

- **Indexes:** \`idx*<table>*<columns>\` -> \`idx_users_email\`
- **Unique Constraints:** \`uk*<table>*<columns>\` -> \`uk_users_email\`
- **Foreign Key Constraints:** \`fk*<table>*<referenced_table>\` -> \`fk_orders_users\`

## NoSQL Database (MongoDB / Mongoose)

MongoDB follows the **JS/JSON ecosystem convention (camelCase) end-to-end** — both at the collection level and the document-field level. This is a deliberate departure from the SQL block above; do not "fix" one to match the other.

### Collections

Use **camelCase**, **plural**.
Examples:

\`\`\`
userProfiles
tenantPermissions
auditLogs
\`\`\`

### Document Fields (Schema Properties)

Use **camelCase** — this is the Mongoose/MongoDB ecosystem standard and matches JSON API fields.
Examples:

\`\`\`JS
{
userId: "123",
fullName: "John Doe",
isActive: true,
createdAt: ISODate("...")
}
\`\`\`

⚠️ Explicit distinction from SQL: Postgres **tables & columns** = \`snake_case\` (\`user_profiles\`, \`full_name\`); Mongo **collections & document fields** = \`camelCase\` (\`userProfiles\`, \`fullName\`) end-to-end. Each ecosystem is internally consistent on its own terms — do not mix them across the boundary.

### Reference Fields (Foreign-key-like)

Use \`<entitySingular>Id\` in **camelCase**, referencing another document's \`\_id\`.
Examples: \`userId\`, \`tenantId\`, \`roleId\`.

### Primary Key

MongoDB's native \`\_id\` (ObjectId) is the default primary key and is exempt from the camelCase word-boundary rule — keep it as \`\_id\`, never rename to \`id\` in the schema.

### Mongoose Schema/Model File Naming

Model definition files follow the **File Suffixes** rule (dot-notation): \`user.schema.ts\`, \`tenant.schema.ts\`. The exported Model variable itself stays PascalCase per the Code Layer rule: \`UserModel\`, \`TenantModel\`.

# Cache Layer (Redis)

Redis is **key-value**, so naming discipline lives entirely in the key string. Use **colon-separated (\`:\`)** hierarchy, **lowercase**, no dashes/camelCase inside segments.

## Key Structure

Pattern: \`<domain>:<entity>:<identifier>[:<qualifier>]\`

\`\`\`
cache:user:123
cache:user:list
tenant:abc123:user:123
\`\`\`

## By Purpose (Prefix Convention)

Prefix the first segment with the _purpose_ of the key so TTL policy and eviction strategy are predictable at a glance:

- **Cache (read-through/write-back):** \`cache:<entity>:<id>\` → \`cache:userprofile:123\`
- **Session:** \`session:<userId>\` → \`session:u_123\`
- **Distributed Lock:** \`lock:<resource>:<id>\` → \`lock:order:456\`
- **Rate Limiting:** \`ratelimit:<scope>:<identifier>\` → \`ratelimit:login:ip_1.2.3.4\`
- **Pub/Sub Channel:** \`events:<entity>:<action>\` → \`events:order:created\`
- **Queue/Job:** \`queue:<jobtype>\` → \`queue:sendemail\`
- **Sorted Set / Leaderboard:** \`leaderboard:<scope>\` → \`leaderboard:global\`

## TTL Discipline

- Every \`cache:_\` and \`ratelimit:_\` key MUST have an explicit TTL set at write time — no permanent cache keys.
- \`session:\*\` TTL must match the token/session policy defined in the security rules (short-lived, refreshable).
- \`lock:\*\` keys must have a short TTL (few seconds) as a safety net against deadlocks from crashed processes.

## Field Names (Hashes)

When using Redis Hash (\`HSET\`), field names inside the hash follow **camelCase**, matching the app's in-memory object shape:

\`\`\`
HSET cache:userprofile:123 fullName "John Doe" isActive "true"
\`\`\`

# Search Layer (Elasticsearch)

## Index Names

Use **kebab-case**, **lowercase**, **plural**, with a version suffix to support zero-downtime reindexing:

\`\`\`
user-profiles-v1
tenant-permissions-v2
audit-logs-v1
\`\`\`

## Aliases

The application always reads/writes through an **alias without the version suffix**; the alias is repointed to the new version on reindex:

\`\`\`
user-profiles -> points to user-profiles-v2
tenant-permissions -> points to tenant-permissions-v1
\`\`\`

## Field Names (Mappings)

Use **camelCase**, matching the source JSON payload (API/Mongo layer) that gets indexed — this keeps the ES document shape a direct mirror of the API response, regardless of whether the source system was Postgres or MongoDB:

\`\`\`JSON
{
"userId": "123",
"fullName": "John Doe",
"createdAt": "2026-01-01T00:00:00Z"
}
\`\`\`

## Analyzers & Tokenizers

Use **snake_case** for custom analyzer/tokenizer/filter names (Elasticsearch's own ecosystem convention):

\`\`\`
vietnamese_analyzer
edge_ngram_tokenizer
lowercase_ascii_filter
\`\`\`

## Ingest Pipelines

Use **kebab-case**, verb-first, describing the transformation:

\`\`\`
enrich-user-profile
normalize-phone-number
\`\`\`

# Infrastructure & DevOps Layer

## Environment Variables

Use **UPPER_SNAKE_CASE**.
Examples:

\`\`\`
APP_PORT
APP_ENV
DB_HOST
JWT_SECRET
REDIS_URL
ELASTICSEARCH_URL
\`\`\`

## Docker & Containers

Use **kebab-case**.
Examples:

\`\`\`YAML
user-service
auth-service
backend
\`\`\`

## CI/CD (Pipelines & Workflow Files)

Use **kebab-case** for both workflow step names and YAML file names.

- File: \`.github/workflows/ci-cd-pipeline.yml\`
- Step/Job Name: \`build-api\`, \`run-tests\`, \`deploy-staging\`

# Git Layer

## Branches

Format: \`<type>/<ticket-id>-<short-description>\` (or \`<type>/<short-description>\` if no ticket exists). Use **kebab-case** for the description.
Types: \`feat\`, \`fix\`, \`refactor\`, \`docs\`, \`chore\`, \`test\`.
Examples:

\`\`\`
feat/ENG-101-user-management
fix/ENG-204-login-api
refactor/auth-service
\`\`\`

# Test Layer

## TypeScript / JavaScript

Match the target file name (including its dot/dash convention) with \`.test.ts\` or \`.spec.ts\`.
Examples:

\`\`\`
user.service.spec.ts
auth.controller.spec.ts
user-profile.test.tsx
\`\`\`

## Python

Prefix with \`test\_\`.
Examples:

\`\`\`
test_user_service.py
test_auth_controller.py
\`\`\`

# Documentation & Configuration Layer

Use **kebab-case** for all documentation and configuration files.
Examples:

\`\`\`
api-guide.md
deployment-guide.md
architecture-overview.md
eslint.config.js
vite.config.ts
docker-compose.yml
\`\`\`

# Prohibited (Strictly Forbidden)

Do not generate or accept code violating ecosystem boundaries:

- _Do not mix casings:_ \`Auth_Service\` (Mixed), \`user-service.py\` (Kebab in Python file).
- _Do not use improper Acronyms:_ \`userID\`, \`APIClient\`, \`UserService.ts\` (Pascal case for TS file).
- _Do not dash-separate an architectural suffix:_ \`user-service.ts\`, \`auth-controller.ts\` — use \`user.service.ts\`, \`auth.controller.ts\` instead.
- _Do not apply SQL snake_case to MongoDB:_ \`user_profiles\` collection, \`full_name\` field in a Mongoose schema — use \`userProfiles\`, \`fullName\`.
- _Do not apply MongoDB/JSON camelCase to Postgres:_ \`fullName\` column in a SQL table — use \`full_name\`.
- _Do not leave a Redis \`cache:*\` or \`ratelimit:*\` key without a TTL._
- _Do not create an Elasticsearch index without a version suffix, or point the application directly at a versioned index instead of its alias._
