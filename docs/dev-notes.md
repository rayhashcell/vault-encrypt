---
title: Development Notes
layout: default
nav_exclude: true
---

# Development Notes

## Releasing New Versions

To release a new version:

1. Update `version` in `package.json`.
2. Run `npm run version` to update `manifest.json` & `versions.json`.
  	* `manifest.json`: holds the new version number and the minimum Obsidian version required for your latest release.
	* `versions.json`: holds the history of version numbers and their minimum Obsidian version, so older versions of Obsidian can download an older version of your plugin that's compatible.
3. Commit the release changes.
4. Create and push a tag using the exact version number with a `v` prefix, such as `v2.4.11`.

The `Publish GitHub Release` workflow builds the plugin and publishes the GitHub release automatically. It uploads the three plugin files from `dist/vault-encrypt-<ver>/vault-encrypt/`:

* `main.js`
* `manifest.json`
* `styles.css`

The workflow can also be run manually from GitHub Actions. Leave the version input empty to release `v<package.json version>`, or provide a `v`-prefixed version such as `v2.4.11`.

## Adding Your Plugin to the Community Plugin List

To add your plugin to the community plugib list: 

1. Publish an initial version.
2. Make sure you have a `README.md` file in the root of your repository.
3. Make a pull request at [obsidian-releases](https://github.com/obsidianmd/obsidian-releases) to add your plugin.

## How to Use

1. Clone this repository.
2. Run `npm i` or `yarn` to install dependencies.
3. Run `npm run dev` to start the compiler in watch mode.

## Manually Installing the Plugin

Copy the files `main.js`, `styles.css`, and `manifest.json` to your vault at `VaultFolder/.obsidian/plugins/your-plugin-id/`, replacing `your-plugin-id` with the actual ID of your plugin.

If the `your-plugin-id` folder does not exist, create it before copying the files.

## API Documentation

For detailed API Documentation, see the [Obsidian API repository](https://github.com/obsidianmd/obsidian-api).
