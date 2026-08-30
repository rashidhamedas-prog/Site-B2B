# Acceptance checklist

- [ ] Official v3 and token docs re-read
- [ ] Empty / combined / unknown / invalid page+sort / empty lookup → 400 `{error}`
- [ ] Pages of 0, 1, 99, 100, 101, 201 records; stable order on equal timestamps
- [ ] URL and unique lookup return the same projection
- [ ] Hidden, non-ACTIVE, soft-deleted, invalid price/image unpublished
- [ ] `retailStock=0` + `wholesaleStock>0` → `availability=false`
- [ ] Active vs expired discount; guarantee omitted when empty
- [ ] Invalid `?variant=` does not become canonical
- [ ] JWT valid / expired / future nbf / wrong aud / wrong alg / missing
- [ ] Metatags in `<head>` for `User-Agent: TorobBot`; HTML readable without JS
- [ ] Feed/API/meta/sitemap parity
- [ ] No 500/2000 hard caps
- [ ] Sitemap does not become empty on API error
- [ ] `git diff` has no secrets
- [ ] Production migrate/deploy only after owner approval
