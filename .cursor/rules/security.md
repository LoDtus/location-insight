---
description: Enterprise Security & Defensive Programming Standards (Fullstack & Multi-Service)
globs: "**/*.{ts,tsx,js,jsx,py,go,rs,env*}"
alwaysApply: true
---

# SYSTEM INSTRUCTIONS FOR AI AGENTS (Security Hardening)

- You MUST enforce the defensive programming principles defined below in every code snippet, architecture layout, and configuration.
- Prioritize structural security (strong typing, schemas, strict ORMs) over implicit trust.
- If a generated route/endpoint lacks validation or authorization, flag it immediately as a security risk before outputting code.

---

# SECURITY RULES (CROSS-STACK ENTERPRISE)

## 1. Input Security & Validation

* **Zero-Trust Input:** Always treat all data from the Client (Body, Query, Params, Headers, WebSockets, Message Queue) as untrusted.
* **Schema-based Validation:** Schema validation MUST be applied before processing (e.g., `Zod`, `Class-Validator` for TypeScript; `Pydantic` for Python).
* **Fail-Early & Strict Filtering:**
  * Reject invalid payloads immediately at the first layer (Middleware/Guard/Pipe).
  * Automatically remove properties not defined in the schema (`whitelist: true` in NestJS, `stripUnknown` in Zod) to prevent **Mass Assignment** vulnerabilities.
* **Sanitization:** Trim whitespace and escape special characters to prevent XSS and Injection attacks.

## 2. Authentication & Authorization

* **Backend Enforced:** Never trust authorization checks performed in the Frontend or Client Components (`use client`). Every API endpoint / Server Action MUST enforce authentication and authorization on the Server side.
* **Inter-Service Authentication:** Communication between the primary Backend and Sub-services (`/services/ai`, `/services/media-stream`) MUST use internal authentication mechanisms (Internal API Key, HMAC Signature, or mTLS) and MUST NOT be publicly exposed.
* **Least Privilege & Deny-by-Default:** Deny access by default except for explicitly designated public routes (e.g., `@Public()`).
* **Idempotent Access Checks:** Ensure authorization checks do not leak structural information (return consistent `403` or `404` responses to prevent resource enumeration).

## 3. Database & Cryptography

* **Safe Database Queries:** String interpolation (`${input}`) in Raw SQL / NoSQL queries is strictly prohibited. Always use Parameterized Queries, Prepared Statements, or ORM Safe Methods (Prisma, TypeORM, Mongoose).
* **No Hardcoded Secrets:** Hardcoding Secrets, API Keys, Passwords, or Access Tokens in source code is strictly prohibited. All sensitive values MUST be loaded through Environment Variables.
* **Password Hashing:** Use **Argon2id** or **Bcrypt** (`saltRounds >= 10`). Never use MD5, SHA1, or plain SHA256 for password hashing.
* **Sensitive Data Encryption:** Encrypt sensitive personally identifiable data stored in the Database (national ID numbers, payment information) using **AES-256-GCM**.

## 4. Output, Upload & Error Handling

* **No Production Stack Traces:** Never return Stack Traces, Database Error Messages, or System Information to Clients in Production.
* **Standardized Error Responses:** When a crash or exception occurs, errors MUST be caught (`try-catch`), logged internally together with a `trackId`, and only the standardized payload should be returned:
  `{"statusCode": 500, "message": "Internal Server Error", "trackId": "err_123456"}`
* **Secure File Uploads:**
  * Verify file types using File Signatures (Magic Bytes), not only file extensions or the `Content-Type` header.
  * Enforce upload size limits (Maximum Body Size).
  * Never store uploaded files directly inside public web directories; use isolated S3 storage or private storage with randomly generated file names.

## 5. Secure Logging

* **PII & Secret Masking:** Never log Passwords, Credit Card information, full Authorization Headers, Refresh Tokens, or API Keys.
* **Log Injection Prevention:** Sanitize user-provided strings before logging (remove `\n` and `\r` characters) to prevent Log Forgery attacks.

## 6. Communication & Network

* **HTTPS & TLS:** HTTPS MUST be enforced for Staging and Production environments (minimum `TLSv1.2`).
* **Strict CORS Policy:** Using `Origin: *` in Production is prohibited. Explicit domain whitelists MUST be configured.
* **Rate Limiting & Payload Limits:** Configure Rate Limiting for sensitive routes (Login, Forgot Password, Payment) and enforce Request Body Size limits to mitigate DoS and Brute-force attacks.

## 7. State, Session & Cookies

* **Secure Cookies:** Cookies containing Sessions or Tokens MUST include the following flags: `HttpOnly`, `Secure` (Production), and `SameSite=Strict` or `Lax`.
* **Token Expiration:** JWT Access Tokens MUST have a short lifetime (15–30 minutes). Use revocable Refresh Tokens stored in Redis or a Database for token renewal.

## 8. Dependency Management

* **Lock Files:** Lock files (`package-lock.json`, `pnpm-lock.yaml`, etc.) MUST be committed.
* **Vulnerability Scanning:** Regularly scan third-party packages for security vulnerabilities (using `npm audit`, `snyk`, or GitHub Dependabot). Do not use libraries that have been archived or have not been maintained for more than two years.