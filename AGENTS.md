# AGENTS.md

## Project Context

This repository is the Vault Encrypt Obsidian plugin focused on encrypted whole-note files and selected inline text.

Treat this project as security-sensitive. The most important invariant is:

- Do not write decrypted whole-note `.cenc` contents to disk during normal encrypted-note editing.

## Recent Changelog Context

The latest commit before the current working changes is:

- `20177b5 feat!: rebrand plugin and adopt custom v2 encryption formats`

The README `Latest Changes > Unreleased` section also records the current change set. Keep future work consistent with these decisions:

- The plugin identity is now `vault-encrypt` / `Vault Encrypt`.
- Runtime identifiers, command IDs, view type, CSS hooks, and docs use Vault Encrypt naming.
- Whole-note encrypted files use the `.cenc` extension.
- Supported whole-note encrypted file data is limited to the current v2 / `2.0` format.
- Inline encryption uses the shield `@v2` marker format, currently `🛡️\`@v2 ...\`🛡️` or hidden in Markdown comments.
- Remembered-password sharing is limited to Vault or File scope.
- Open whole-note encrypted notes should auto-lock when the remembered-password cache expires.
- A remembered whole-note password can optionally be confirmed through a prefilled password dialog instead of opening automatically.
- Legacy crypto helpers, obsolete inline markers, external password-file caching, and empty-selection inline encryption prompts were removed.
- Old encrypted formats and old inline markers are intentionally unsupported; fail gracefully rather than restoring compatibility.

## Security Coding Rules

- Never log passwords, decrypted plaintext, full encrypted file JSON, password hints with surrounding sensitive context, or cached password objects.
- Runtime plugin logs must go through `src/services/DevConsole.ts`; `DevConsole` is disabled by default.
- Do not call `console.*` directly from Obsidian runtime code. CLI tools under `src/tools/` may use console output for command-line results.
- If debugging encoded file data, log only metadata such as length, version, or booleans. Do not log `{data}` or full `FileData`.
- Password cache entries must remain memory-only. Do not persist remembered passwords to plugin settings, files, localStorage, sessionStorage, or clipboard.
- Clearing remembered passwords must also lock and close open whole-note encrypted views so plaintext does not remain visible after the cache is cleared.
- Timeout expiry must lock open whole-note encrypted views, not only clear the password cache.
- Whole-note save paths must encrypt before disk writes. `EncryptedMarkdownView.getViewData()` may return encrypted data only while the view is intentionally saving.
- If unsupported encrypted file versions are encountered, show a controlled failure and detach/stop. Do not throw uncaught errors from the view load path.
- Inline encryption markers are Markdown syntax. Reject or safely encode user-controlled values that can break the marker grammar, especially backticks in password hints.
- Hints are stored in encrypted file metadata or inline marker text. Treat hints as public/non-secret and make UI text clear about that.
- The `Decrypt in-place`, whole-note `Decrypt note`, and `Copy` flows intentionally expose plaintext. Keep these actions explicit and avoid triggering them automatically.

## Crypto Notes

- Current encryption uses WebCrypto PBKDF2-SHA512 plus AES-GCM-256 through `CryptoHelper2304`.
- Salt and IV must remain random per encryption using `crypto.getRandomValues`.
- Do not reuse an IV with the same derived key.
- Future crypto formats must be versioned. Add a new branch rather than silently changing the meaning of existing `2.0` file data or inline `@v2` payloads.
- If adding Argon2id or scrypt, keep mobile performance in mind. These KDFs are memory-hard and should be optional or benchmarked, not an untested forced default.
- If KDF parameters become configurable, store the parameters needed for decryption in the encrypted payload metadata.

## Mobile Notes

- `manifest.json` currently has `"isDesktopOnly": false`; runtime code must avoid Node/Electron-only APIs.
- `crypto.subtle` and `crypto.getRandomValues` are expected browser APIs. Any new dependency must be checked on Obsidian Android/iOS.
- `navigator.clipboard.writeText` may be less reliable on mobile. Wrap new clipboard use in error handling and show a user-facing failure notice.
- Avoid expensive synchronous crypto or parsing work on the UI thread, especially on Android.

## Localization Rules

- Plugin settings language is plugin-managed and limited to English (`en`) and Simplified Chinese (`zh-CN`); do not sync it with Obsidian's language.
- Any setting item change must update both English and Simplified Chinese translations in the central i18n module.
- Setting-related dialogs, buttons, placeholders, and validation messages are part of the same localization surface and must also keep both translations in sync.
- Do not add a translation key for only one language, and do not let the Simplified Chinese copy drift from the English meaning.

## Validation

Use these checks after security-sensitive changes:

- `npm run build`
- `git diff --check`
- `rg -n "^[[:space:]]*console\\." src --glob '!src/tools/**'`
- `rg -n "\\{data\\}|password|decrypted|cachedUnencryptedData|localStorage|sessionStorage|navigator\\.clipboard" src`

When updating the installed test plugin, build first and copy the generated files from:

- `dist/vault-encrypt-<version>/vault-encrypt/`

to:

- `/Users/bisco/private/obvault/.obsidian/plugins/vault-encrypt/`

## Release Process

For normal GitHub releases:

1. Keep plugin metadata versions as plain semver without a `v` prefix:
   - `package.json`
   - `package-lock.json`
   - `manifest.json`
   - `versions.json`
2. Bump the package version with `npm version patch --no-git-tag-version` unless a specific version is requested. This runs `version-bump.mjs`, which syncs `manifest.json` and appends `versions.json`.
3. Do not update `manifest-beta.json` for a normal stable release unless the user explicitly asks for beta release metadata.
4. Run `npm run build` and `git diff --check`.
5. Commit the release changes.
6. Create and push a Git tag with a `v` prefix, for example `v2.4.11`.

The `Publish GitHub Release` GitHub Actions workflow is triggered by `v*.*.*` tags or by manual dispatch. It builds the plugin and publishes a GitHub Release named after the `v`-prefixed tag. The workflow uploads exactly these plugin files from `dist/vault-encrypt-<version>/vault-encrypt/`:

- `main.js`
- `manifest.json`
- `styles.css`
