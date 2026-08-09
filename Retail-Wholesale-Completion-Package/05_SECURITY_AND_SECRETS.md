# Security and Secrets

Apply threat modeling to storefronts, admin, wholesale accounts, APIs, webhooks, uploads, integrations, and CI/CD.

## Required controls

- Central authentication; server-side authorization with least privilege, ownership checks, and protected admin/wholesale boundaries.
- Secure session/cookie/token lifecycle, CSRF protection where applicable, rate limits/abuse controls, and safe account recovery.
- Validate input and encode output; parameterize queries; constrain uploads; defend against SSRF, injection, XSS, traversal, and unsafe redirects.
- Recalculate price, discount, tax, shipping, inventory, and payable amount server-side. Never trust client totals or role claims.
- Verify payment/webhook signatures, timestamps/replay windows, idempotency, amount/currency/order binding, and state transitions.
- Store secrets only in approved secret/config systems; provide redacted `.env.example` names and rotation ownership. Prevent secrets/PII in logs and errors.
- Encrypt transport; protect sensitive data at rest where required; define retention/deletion and audit events.
- Review dependencies, licenses, CI permissions, artifact provenance, security headers, CORS, CSP where feasible, and error disclosure.

## Response rules

Do not exploit production or expose vulnerability details broadly. For suspected active compromise or leaked secret, stop risky work, preserve evidence, notify the authorized owner, and follow incident/rotation procedures. Record scans and manual checks with tool/version/date and triage false positives; a scan alone is not acceptance.

Security findings in public/shared AI-DOS documents must be minimally disclosed and redacted. Claim affected remediation files before editing; use an approved private channel for exploit details, secret identifiers, or sensitive incident evidence.
