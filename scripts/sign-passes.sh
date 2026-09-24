#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
source_root="$repo_root/build/pass-source"
output_root="$repo_root/dist/passes"

: "${PASS_CERT_PEM:?Set PASS_CERT_PEM to the Pass Type ID certificate PEM path}"
: "${PASS_KEY_PEM:?Set PASS_KEY_PEM to the matching private-key PEM path}"
: "${APPLE_WWDR_PEM:?Set APPLE_WWDR_PEM to the Apple WWDR certificate PEM path}"

mkdir -p "$output_root"
shopt -s nullglob
sources=("$source_root"/*)
if (( ${#sources[@]} == 0 )); then
  echo "No pass sources found. Run npm run build first."
  exit 1
fi

for source_dir in "${sources[@]}"; do
  [[ -d "$source_dir" ]] || continue
  slug="$(basename "$source_dir")"
  work_dir="$(mktemp -d)"
  cp -R "$source_dir"/. "$work_dir"/
  (
    cd "$work_dir"
    find . -type f ! -name manifest.json ! -name signature -print0 \
      | sort -z \
      | python3 -c 'import hashlib,json,sys; files=sys.stdin.buffer.read().split(b"\0"); print(json.dumps({p.decode()[2:]:hashlib.sha1(open(p.decode(),"rb").read()).hexdigest() for p in files if p},separators=(",",":")))' \
      > manifest.json
    openssl smime -binary -sign \
      -certfile "$APPLE_WWDR_PEM" \
      -signer "$PASS_CERT_PEM" \
      -inkey "$PASS_KEY_PEM" \
      -in manifest.json \
      -out signature \
      -outform DER
    zip -q -X -r "$output_root/$slug.pkpass" .
  )
  rm -rf "$work_dir"
  echo "Signed $slug.pkpass"
done
