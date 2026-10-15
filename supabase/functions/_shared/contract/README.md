# Rental agreement signing (Idura)

Flow on the "Contract and payment" step:

1. `create-booking`: the server computes the price and creates the booking (`pending`, 30-minute hold).
   Works for guests: the browser sends a random access key, the server stores its hash, and every
   later call (contract, signing link, PDF, payment) must present the key (`_shared/booking-access.ts`).
2. `booking-contract` `create`: fills `rental-agreement-en.template.pdf` and creates an Idura signature order. The step opens with the contract already prepared (the client auto-calls `create`), so the customer can review/sign right away.
3. The customer signs with BankID on Idura and is redirected back.
4. **Single-signer (current):** the customer's signature completes the agreement. `syncContract` closes the order, stores the signed PDF in the private `contracts` bucket (status `signed`), and emails the signed PDF to the customer and `CONTRACT_COMPLETED_NOTIFY_EMAIL`. The broker countersignature step is omitted for now — to restore it, add the broker signatory back in `service.ts#ensureContract` (the `renter_signed` → broker path in `syncContract` is still intact, including `notifyBrokerOnce`).
5. `create-payment` charges the stored booking total, and only if the contract is `renter_signed` or `signed`.

`idura-webhook` and the `status` action both reconcile against the Idura API (`service.ts#syncContract`), so a missed or duplicated webhook is harmless.

## Secrets (`supabase secrets set ...`)

| Name | Value |
| --- | --- |
| `IDURA_SIGNATURES_CLIENT_ID` | Client ID of the Idura **Signatures** application |
| `IDURA_SIGNATURES_CLIENT_SECRET` | Client secret of that application |
| `IDURA_WEBHOOK_SECRET` | Random 32–64 bytes, base64: `openssl rand -base64 32` |
| `IDURA_BROKER_NOTIFY_EMAIL` | Who receives the broker signing link (unused while single-signer, still required) |
| `CONTRACT_COMPLETED_NOTIFY_EMAIL` | Optional. Admin copy of each completed contract. Default `dev.bahadurali@gmail.com` |
| `APP_BASE_URL` | Public site URL, e.g. `https://primecar.no` (used for redirects) |
| `IDURA_ORDER_TTL_DAYS` | Optional, default `7` (1–30) |
| `IDURA_SIGNATURES_ENDPOINT` | Optional, default `https://signatures.idura.app/v1/graphql` |
| `IDURA_WEBHOOK_URL` | Optional override, default `<SUPABASE_URL>/functions/v1/idura-webhook` |

Email uses the existing `SMTP_*` secrets (same as `send-booking-email`); `SMTP_FROM` is optional.

Never expose these through `VITE_*` variables. `VITE_IDURA_CLIENT_ID` (BankID login) is a different, public value.

## Idura dashboard

- Create the application with product **Signatures**. In the test tenant, pick the `*.test.idura.broker` domain.
- Enable the **NO BankID** eID provider (plus any other eID the broker uses to countersign).
- Production use of national eIDs requires Idura's production approval.

## Deploy

```sh
# Run in the SQL Editor (or `supabase db push` if the migration history is in sync):
#   supabase/migrations/20261008130000_booking_contracts_idura.sql
#   supabase/migrations/20261009090000_booking_access_key.sql
#   supabase/migrations/20261012120000_contract_completed_notify.sql
supabase functions deploy create-booking booking-contract idura-webhook create-payment
```

`booking-contract` bundles the template PDF and font via `static_files` in `supabase/config.toml`.

## Template

`rental-agreement-en.template.pdf` is generated from `files/Leiekontrakt_EN.pdf` by
`scripts/contract/prepare-template.py` (which removes the pre-printed placeholder amounts).
If the source PDF changes, re-run the script and re-check the coordinates in `pdf.ts`
(`CONTRACT_FIELD_SLOTS`).

## Tests

```sh
cd supabase/functions
deno test --config deno.test.json --allow-read --allow-env _shared/
```
