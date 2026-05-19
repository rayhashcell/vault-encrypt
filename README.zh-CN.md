# Vault Encrypt Obsidian 插件

[English](README.md)

Vault Encrypt 是一个 Obsidian 社区插件，用于在库内加密整篇笔记和选中的行内文本。

这个项目由 rayman 维护，基于开源项目 Meld Encrypt 修改而来。Meld Encrypt 官方 GitHub 地址：[meld-cp/obsidian-encrypt](https://github.com/meld-cp/obsidian-encrypt)。

Vault Encrypt 保留了在 Obsidian 中编辑加密笔记的核心目标，同时收紧本地安全模型，简化受支持的格式，并补充更适合日常维护加密笔记的工作流。

## 安全模型

- 整篇加密笔记保存为 `.cenc` 密文文件。
- 正常编辑整篇加密笔记时，不会把解密后的正文写回磁盘。
- 记住的密码只保存在当前 Obsidian 会话的内存中。
- 密码提示是公开元数据，不要把秘密写进提示里。
- 如果忘记密码，Vault Encrypt 无法恢复被加密的内容。
- 当前加密实现没有经过独立安全审计，请自行保留备份。

## 基于 Meld Encrypt 做了哪些修改

相对 `meld-cp-main` 这个 fork 基线，Vault Encrypt 重点做了这些功能相关修改：

| 功能范围 | Meld Encrypt | Vault Encrypt |
| --- | --- | --- |
| 整篇笔记格式 | 支持 `.mdenc` 和 `.encrypted` 整篇加密文件，也包含旧版加密数据格式。 | 统一使用 `.cenc` 整篇加密文件，并且只支持当前 v2 / `2.0` 加密文件数据。 |
| 行内加密格式 | 支持旧的行内加密标记格式。 | 使用盾牌 `@v2` 行内标记，可在阅读模式显示，也可隐藏在 Markdown 注释中。 |
| 旧格式处理 | 保留旧 crypto helper 和旧行内标记兼容逻辑。 | 移除旧 crypto helper 和旧行内标记支持；遇到不支持的加密版本时受控失败。 |
| 记住密码共享范围 | 支持按库、文件夹、文件、外部文件共享/读取密码。 | 只保留按库和按文件两种范围，移除了按文件夹共享和外部密码文件缓存。 |
| 记住密码超时 | 所有记住的密码共用一个全局过期时间。默认 30 分钟；0 表示保留到 Obsidian 关闭。读取或保存任意缓存密码，都会刷新全部缓存密码的共同过期时间。 | 每个缓存密码条目单独记录过期时间。默认 30 分钟，可设置为 0 到 120 分钟；0 表示保留到 Obsidian 关闭。只有密码成功使用或保存后，才刷新对应条目的过期时间。 |
| 已打开加密笔记的超时处理 | 清除或过期记住的密码后，不一定会关闭已经打开的加密视图。 | 缓存密码过期或被清除时，会锁定相关已打开的整篇加密笔记。 |
| 使用已记住密码打开笔记 | 已记住的密码可以直接打开整篇加密笔记。 | 可选择先显示预填密码的确认弹窗，再打开整篇加密笔记。 |
| 空选择行内加密 | 没有选中文本时，可以弹窗输入待加密文本。 | 行内加密必须先明确选中文本。 |
| 批量修改密码 | 没有批量密码修改向导。 | 增加移动端兼容的批量密码修改向导，支持 `.cenc` 文件和包含行内加密块的 Markdown 文件，并创建密文备份。 |
| 多语言 | 设置 UI 主要是英文。 | 设置页和相关弹窗支持插件管理的英文和简体中文。 |

## 现有完整功能

### 整篇笔记加密

- 创建 `.cenc` 整篇加密笔记。
- 通过自定义加密 Markdown 视图打开和编辑加密笔记。
- 将普通 Markdown 笔记转换为 `.cenc` 加密笔记。
- 在明确执行解密操作时，将 `.cenc` 笔记解密回普通 Markdown。
- 修改加密笔记的密码和公开提示。
- 锁定并关闭单个加密笔记。
- 通过命令面板或 ribbon 按钮锁定并关闭所有已打开的加密笔记。
- 遇到不支持的加密文件版本时，给出受控失败提示并停止打开。

### 行内文本加密

- 加密普通 Markdown 笔记中精确选中的文本。
- 通过命令面板、ribbon 按钮或光标位置解密行内加密文本。
- 阅读模式中可显示盾牌标记，也可用 Markdown 注释隐藏行内加密块。
- 在弹窗中查看解密后的文本。
- 可复制明文、将编辑后的内容重新保存为加密标记，或直接原地解密。
- 可在行内标记中保存公开密码提示。

<p>
  <img src="docs/assets/inline-v2-marker-zh-cn.png" alt="阅读模式中的行内 @v2 加密标记" width="760">
</p>

### 记住密码

- 成功使用过的密码只会被临时记在内存中。
- 可完全关闭记住密码。
- 记住密码支持两种共享范围：
  - 库：此库内整篇加密笔记和行内加密文本共用一个缓存密码。
  - 文件：按文件路径分别缓存密码，不包含扩展名。
- 超时时间可设置为 0 到 120 分钟。
- 超时时间为 0 时，缓存密码保留到 Obsidian 关闭。
- 只有密码成功使用或保存后才刷新超时计时。
- 相关缓存密码过期时，自动锁定已打开的整篇加密笔记。
- 可选择在使用已记住密码打开整篇加密笔记前，先显示预填密码的确认弹窗。

<p>
  <img src="docs/assets/vault-encrypt-settings-zh-cn.png" alt="Vault Encrypt 设置页中的语言、密码缓存、超时和批量修改入口" width="760">
</p>

### 批量修改密码

- 扫描库中的 `.cenc` 整篇加密文件和包含行内加密块的 Markdown 文件。
- 按文件夹分组展示候选项。
- 支持选择单个文件、整个文件夹或全部候选项。
- 将选中内容从旧密码批量轮换为新密码。
- 使用一个新的公开提示覆盖所有被轮换的加密 payload。
- 在 `AA Vault Encrypt Backups/Password Rotation` 下创建仍然是密文的原始内容备份。
- 如果文件在预检后发生变化，会跳过该文件。
- 如果部分写入后发生失败，会尝试用备份回滚已修改文件。
- 修改成功后刷新记住密码缓存。

<p>
  <img src="docs/assets/password-rotation-selection-zh-cn.png" alt="批量修改密码向导中的按文件夹分组选择界面" width="760">
</p>

<p>
  <img src="docs/assets/password-rotation-password-step-zh-cn.png" alt="批量修改密码向导中的旧密码、新密码和公开提示输入界面" width="760">
</p>

### 多语言

- 设置页和插件管理的弹窗支持英文和简体中文。
- 插件语言由 Vault Encrypt 设置项控制，不自动跟随 Obsidian 的语言。

### 离线工具

- `tools/decrypt.html` 可在 Obsidian 外解密受支持的 Vault Encrypt payload。
- `tools/mdenc.mjs` 提供命令行工作流，用于处理受支持的加密 Markdown 和 `.cenc` 内容。

## 命令

| 命令 | 用途 |
| --- | --- |
| Create new encrypted note | 创建新的 `.cenc` 加密笔记。 |
| Lock and Close all open encrypted notes | 保存、锁定并关闭加密笔记视图。 |
| Clear Session Password Cache and Lock Notes | 清除记住的密码，并锁定已打开的加密笔记。 |
| Convert to or from an Encrypted note | 将当前 Markdown 转换为 `.cenc`，或将 `.cenc` 解密回 Markdown。 |
| Encrypt Selection | 加密选中的行内文本。 |
| Decrypt | 查看或解密行内加密文本。 |
| Rotate selected encrypted passwords | 打开批量密码修改向导。 |

## 安装

本地开发或手动安装：

1. 运行 `npm install`。
2. 运行 `npm run build`。
3. 将以下生成文件复制到你的 vault 插件目录：
   - `dist/vault-encrypt-<version>/vault-encrypt/main.js`
   - `dist/vault-encrypt-<version>/vault-encrypt/manifest.json`
   - `dist/vault-encrypt-<version>/vault-encrypt/styles.css`

目标目录应为：

```text
<your-vault>/.obsidian/plugins/vault-encrypt/
```

## 开发

```bash
npm install
npm run build
npm run build-tool-decrypt
npm run build-tool-mdenc
```

常用校验：

```bash
npm run build
git diff --check
rg -n "^[[:space:]]*console\\." src --glob '!src/tools/**'
```

## 兼容性说明

Vault Encrypt 不为旧插件 ID、旧命令 ID、旧 view type 或旧 CSS 类保留兼容别名。

当前运行时不支持旧 Meld Encrypt 整篇笔记格式，也不支持旧行内加密标记。替换现有插件安装前，请先保留备份。
