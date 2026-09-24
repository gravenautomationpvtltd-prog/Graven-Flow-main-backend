# Roadmap

## Done
- [x] Split BIE manager vs staff experience (separate dashboards, review queue, team scorecard, per-person page)
- [x] Tender tracker: full dates, fees/EMD, award details, document uploads, deadlines and status history
- [x] Manager performance view (/bie/performance) with per-person vs team comparison
- [x] Executive personal work page (/bie/my-work) with step tracker and submissions
- [x] End-to-end tender walkthrough verified (assign - submit - approve - scorecard + history)
- [x] Accounts e-invoice & e-way bill integration wired: Accounts Orders tab, auto invoice draft, Generate IRN dialog, direct-government-IRP edge functions
- [x] GSTZen GSP wired end to end (sandbox-verified real IRN + QR): settings token field, both edge functions, token-only credential guard
- [ ] User action: paste live GSTZen API key in Settings → E-Invoice and switch off Sandbox Mode to go live

## Backlog
- [ ] Deploy edge functions `import-products-csv` and `import-list-prices`
- [ ] Playwright verification of ready-stock badge/filter/premium
- [x] Edit-product form prefills every existing value (verified in form code)
- [ ] Configure direct IRP credentials (IRP portal Client ID/Secret/username/password), whitelist app outbound IP, add IRP_PUBLIC_KEY_PEM backend secret
