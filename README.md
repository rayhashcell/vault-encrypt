# Custom Encrypt Plugin for Obsidian

**Create Encrypted Notes Within Your [Obsidian.md](https://obsidian.md/) Vault**

Custom Encrypt is a community plugin fork that lets you encrypt and decrypt your notes in [Obsidian](https://obsidian.md/). You can choose to encrypt an entire note or just selected text within a note.

Encrypted notes are never decrypted to disk giving you peace-of-mind that the decrypted contents haven't been sync'd or backed up to external systems.

---

> [!WARNING]
> ⚠️ Use at Your Own Risk ⚠️
> - Your passwords are never stored. If you forget your password, your notes cannot be decrypted..
> - The encryption methods used have not been independently audited. Unauthorized access may be possible if someone gains access to your files.
> - Bugs may be introduced at any time. You are solely responsible for maintaining backups of your notes.

---

## Ongoing Maintenance and Development

If you find this plugin useful please support the ongoing maintenance and development by:
* [Staring ⭐ this repo](https://github.com/meld-cp/obsidian-encrypt)
* [Buying me a coffee ☕](https://www.buymeacoffee.com/cleon)
* [Sponsoring ❤️ me](https://github.com/sponsors/meld-cp).

Thank you for your support 😊

<a href="https://www.buymeacoffee.com/cleon" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 50px !important;" ></a>


## Latest Changes

Information about the latest release can be found on the [release notes](https://meld-cp.github.io/obsidian-encrypt/release-notes.html) page.

### Unreleased

- Rebranded the plugin package, manifest, command IDs, view type, CSS hooks, and documentation from Meld Encrypt to Custom Encrypt.
- Changed the whole-note encrypted file extension to `.cenc` and limited supported encrypted file data to the v2 format.
- Updated inline encryption to use the new `🛡️@v2` marker format, including Reading view marker rendering and the offline `mdenc` tools.
- Simplified remembered-password sharing to Vault or File scope, added optional confirmation before opening notes with a remembered password, and auto-lock open encrypted notes when the password cache expires.
- Refined remembered-password timeout semantics so prefilled password reads do not extend the timeout, successful password use or save refreshes it, and File scope expires per file.
- Removed legacy crypto helpers, obsolete inline marker support, external password-file caching, and the empty-selection text prompt for inline encryption.
- Refined settings labels, password visibility controls, unsupported-format handling, and related documentation.
- Added opt-in appearance helpers for readable Markdown line height, customizable rainbow file explorer folders, file-type icons, and file extension badges.
- Added a mobile-compatible password rotation wizard for selected `.cenc` notes and Markdown files with inline encrypted blocks, with original-content backups where encrypted payloads remain ciphertext.

Report any bugs or features requests [here](https://github.com/meld-cp/obsidian-encrypt/issues).


## Documentation

Documentation can be found [here](https://meld-cp.github.io/obsidian-encrypt/)
