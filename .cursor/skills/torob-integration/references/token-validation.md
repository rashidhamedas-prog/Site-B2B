# JWT validation

Official guide: https://github.com/torob/Torob-Sync/blob/main/torob_api_token_guide.md

## Headers

- `X-Torob-Token` required
- `X-Torob-Token-Version` must be exactly `1`

## Official public key (not a secret)

```
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAt6Mu4T0pBORY11W+QeM35UsmLO3vsf+6yKpFDEImFk0=
-----END PUBLIC KEY-----
```

## Checks

1. Algorithm allowlist: `EdDSA` only. Reject `none`, HS*, RS*.
2. Signature with the official public key (or a **test** key from env in test/staging only).
3. Require `exp`, `nbf`, `aud`.
4. `aud` equals configured audience of **this** endpoint (`TOROB_API_AUDIENCE=api.example.com`).
5. Do not accept a list of all shop domains.
6. Do not take audience from `Host` / `X-Forwarded-Host` unless you have a separate trusted-proxy identity check; even then, config wins.
7. Invalid or missing token → HTTP 401.
8. Never log the token or payload claims that are not needed. Public key may live in repo; private key and live JWTs must not.

IP allowlists are optional extra defense, never a JWT replacement.

Test tokens: generate an Ed25519 pair in the test suite. Never forge Torob's private key.
