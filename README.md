# REMCERT Digital Business Card Platform

This repository generates centrally managed digital business cards for REM Consulting employees. Each roster entry produces:

- A mobile share page
- A QR code
- A downloadable Apple Contacts vCard
- Apple Wallet pass source files
- A signed `.pkpass` when Apple signing secrets are configured

## Add or update an employee

1. Put the employee headshot in `assets/photos/`.
2. Add or update their record in `data/employees.json`.
3. Commit and push to `main`.

GitHub Actions rebuilds and publishes every card.

## Local build

```bash
npm install
npm run build
npm test
```

Generated web files are written to `dist/`. Unsigned Wallet source packages are written to `build/pass-source/`.

## Apple account setup

Enroll REM Consulting LLC in the Apple Developer Program as an organization. Then:

1. Register the Pass Type ID `pass.com.remcert.businesscard`.
2. Create a Pass Type ID certificate.
3. Convert the downloaded certificate and its matching private key to PEM.
4. Download Apple's current WWDR intermediate certificate and convert it to PEM.
5. Base64-encode the three PEM files and store them as GitHub Actions secrets.

Never commit certificates or private keys to this repository.

See [APPLE_SETUP.md](APPLE_SETUP.md) for the exact Apple, certificate, GitHub secret, DNS, and employee-onboarding steps.

## Required GitHub variables

Repository **Settings → Secrets and variables → Actions → Variables**:

- `PUBLIC_BASE_URL` — final root URL, such as `https://cards.remcert.com`
- `PASS_TYPE_IDENTIFIER` — `pass.com.remcert.businesscard`
- `APPLE_TEAM_IDENTIFIER` — Apple Team ID shown in the developer account

## Required GitHub secrets

Repository **Settings → Secrets and variables → Actions → Secrets**:

- `PASS_CERT_PEM_BASE64`
- `PASS_KEY_PEM_BASE64`
- `APPLE_WWDR_PEM_BASE64`

## GitHub Pages

In repository **Settings → Pages**, set the source to **GitHub Actions**. The included workflow builds, signs, validates, and deploys the card site after every push to `main`.

## Current roster

- Richard Mitchell — President

The first generated card uses `https://cards.remcert.com/richard-mitchell/` unless `PUBLIC_BASE_URL` is changed.
