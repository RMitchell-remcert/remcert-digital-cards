# Apple Wallet setup for REMCERT

One Apple Developer Program organization membership can sign the cards for Richard and future REMCERT employees. There is no separate Apple fee per employee.

## 1. Enroll the company

Enroll **REM Consulting LLC** in the Apple Developer Program as an organization at:

https://developer.apple.com/programs/enroll/

Apple currently charges the organization one annual membership fee. Apple may ask the person enrolling to verify their authority to bind the company.

## 2. Create the pass identity

In **Certificates, Identifiers & Profiles**:

1. Create a Pass Type ID with description `REMCERT Digital Business Cards`.
2. Use identifier `pass.com.remcert.businesscard`.
3. Create a Pass Type ID certificate for that identifier.
4. Download the certificate and install it on the Mac that created the certificate request.
5. In Keychain Access, export the pass certificate **with its private key** as a password-protected `.p12` file.

The private key never belongs in the repository.

## 3. Convert the signing files

On a trusted Mac, from the folder containing the exported `.p12` and Apple's current WWDR intermediate certificate, run:

```bash
openssl pkcs12 -in remcert-pass.p12 -clcerts -nokeys -out pass-cert.pem
openssl pkcs12 -in remcert-pass.p12 -nocerts -nodes -out pass-key.pem
openssl x509 -inform DER -in AppleWWDRCA.cer -out apple-wwdr.pem
```

If the WWDR download has a different filename, substitute that filename in the third command.

## 4. Add GitHub settings

In the card repository, open **Settings → Secrets and variables → Actions**.

Add these repository variables:

- `PUBLIC_BASE_URL` = `https://rmitchell-remcert.github.io/remcert-digital-cards` (use `https://cards.remcert.com` only after its DNS is connected)
- `PASS_TYPE_IDENTIFIER` = `pass.com.remcert.businesscard`
- `APPLE_TEAM_IDENTIFIER` = the Team ID shown in the Apple Developer account

Encode each PEM as a single line:

```bash
base64 < pass-cert.pem | tr -d '\n'
base64 < pass-key.pem | tr -d '\n'
base64 < apple-wwdr.pem | tr -d '\n'
```

Store the three outputs as GitHub Actions secrets:

- `PASS_CERT_PEM_BASE64`
- `PASS_KEY_PEM_BASE64`
- `APPLE_WWDR_PEM_BASE64`

Delete the unencrypted `pass-key.pem` from the Mac after the GitHub secret has been saved. Keep the password-protected `.p12` in a secure company archive.

## 5. Publish the card site

1. In **Settings → Pages**, choose **GitHub Actions** as the source.
2. Optional: point the DNS CNAME record for `cards.remcert.com` to the GitHub Pages hostname, then change `PUBLIC_BASE_URL` after GitHub verifies the domain.
3. Push to `main` or run the workflow manually.
4. Open `https://rmitchell-remcert.github.io/remcert-digital-cards/richard-mitchell/` on an iPhone and tap **Add to Apple Wallet**.

## Add another employee

1. Add their square headshot to `assets/photos/`.
2. Copy Richard's record in `data/employees.json` and replace the personal details.
3. Give the employee a unique lowercase slug, such as `jane-smith`.
4. Commit and push. GitHub rebuilds the page, QR code, contact file, and signed Wallet pass automatically.
