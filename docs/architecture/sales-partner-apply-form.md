# Sales partner configurable apply form

Status: implemented  
Task: `TASK-20261002-002`  
Date: 2026-10-02

## Purpose

Admins configure which fields appear on `/sales-partnership` apply, mark them required, reorder, and add custom text fields. Reviewers see full answers in an admin drawer before approve/reject. Partners set a panel password after OTP login.

## Data

| Store | Shape |
|-------|--------|
| `app_settings.key = salesPartners` | `applyFormFields: ApplyFormField[]` |
| `sales_partner_applications.answers` | jsonb snapshot of submitted answers |
| `sales_partner_profiles.applicationAnswers` | jsonb copy after verify / approve |

Locked keys (always enabled + required): `displayName`, `phone`, `acceptTerms`.

## API

- `GET /v1/sales-partner-program/public-settings` → includes enabled `applyFormFields`
- `POST /v1/sales-partner-applications` → validates against configured fields
- `GET /v1/admin/sales-partners/applications/:id` → full phone + answer rows
- `PATCH /v1/sales-partners/me/password` → set/change password; reissues `purpose=sales_partner` JWT
- OTP login marks verified session so first password set needs no current password

## Security

- List endpoints keep phone and national ID masked
- Detail endpoint is admin-only
- Passwords hashed with bcrypt; never returned
- National ID checksum-validated; stored in answers jsonb (admin detail only for full value)
