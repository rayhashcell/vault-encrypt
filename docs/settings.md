---
title: Settings
layout: default
nav_order: 4
---

# Settings 

To customize the plugin, follow these steps: 

 1. Open **Settings** by clicking the **Settings** icon ![settings](assets/set_ico.png) in the toolbar. 
 2. Select **Custom Encrypt** from the list on the left.
   
The following tables list the available settings and their descriptions:

## Password Settings

| Setting | Description |
|--|--|
| Confirm password when encrypting | Ask for the password twice when encrypting, so typos are caught before encrypted content is written. |
| Remember passwords during this session | Keep successfully used passwords in memory for this Obsidian session. Cached passwords are cleared when this is disabled, when Obsidian closes, or when the timeout expires. Open whole-note encrypted tabs lock when the timeout expires. |
| Share remembered passwords by | Choose how cached passwords are shared: Vault uses one shared password across the vault; File caches passwords separately by file path, without the file extension. |
| Confirm remembered password before opening encrypted notes | When a whole-note password is already remembered, show the password dialog with it prefilled instead of opening the note automatically. |
| Remember password (for ... minutes) | 0 keeps cached passwords until Obsidian closes. 1-120 clears the cache after that many minutes; the timer refreshes when a cached password is used or saved. |

## In-place Encryption

| Setting | Description |
|--|--|
| Inline marker search limit | Maximum characters to scan before and after the cursor or selection when finding inline encryption markers. Increase this for very long encrypted blocks. |
| Show inline encryption markers in Reading view by default | Default for new inline encryption only. On shows lock markers in Reading view; off hides them with Markdown comments. |
