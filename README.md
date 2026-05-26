# Unraid Icon Manager

一个基于 Node.js 的 Unraid Docker 图标管理工具，支持普通 Docker 容器和 Compose Manager 项目的图标读取、预览、替换和同步。

#### ✨ 功能特性

- SSH 连接 - 通过 SSH/SFTP 连接 Unraid，不依赖 Unraid Web API
- Docker 图标读取 - 读取 dockerMan 模板、Compose Manager 配置和真实容器状态
- 图标快速替换 - 支持 URL 图标和 Unraid 本地路径图标
- 本地图标库 - 支持下载、搜索和选择本地图标库
- 自动复制图标 - 从图标库选择后自动复制到 Docker 映射目录
- 自动备份 - 同步前自动备份原始模板文件
- 自动刷新 - 同步后刷新目标容器，让 Docker label 使用新图标
- 本地加密 - SSH 凭据只保存在本地数据目录，并加密存储
- Docker 部署 - 支持 Docker / Docker Compose 一键部署

#### 🚀 快速开始

##### 使用 Docker Compose（推荐）

```yaml
services:
  unraid-icon-manager:
    image: javazwz123/unraid-icon-manager:latest
    container_name: unraid-icon-manager
    restart: unless-stopped
    ports:
      - "3149:3149"
    environment:
      PORT: "3149"
      UNRAID_ICON_SECRET: "CHANGE_ME_TO_A_LONG_RANDOM_STRING"
      UNRAID_ICON_STORE_DIR: "/app/icons"
    volumes:
      - /mnt/user/appdata/unraid-icon-manager:/app/data
      - /mnt/user/appdata/unraid-icon-manager/icons:/app/icons
```

启动后访问：

```text
http://你的Unraid-IP:3149
```

##### 使用 Docker Run

```bash
docker run -d \
  --name unraid-icon-manager \
  --restart unless-stopped \
  -p 3149:3149 \
  -e UNRAID_ICON_SECRET="CHANGE_ME_TO_A_LONG_RANDOM_STRING" \
  -e UNRAID_ICON_STORE_DIR="/app/icons" \
  -v /mnt/user/appdata/unraid-icon-manager:/app/data \
  -v /mnt/user/appdata/unraid-icon-manager/icons:/app/icons \
  javazwz123/unraid-icon-manager:latest
```

#### 📖 基本使用

1. 访问系统 - 打开 `http://你的Unraid-IP:3149`
2. 配置 SSH - 填写 Unraid SSH 地址、端口、用户名和密码
3. 测试连接 - 保存设置并测试 SSH/SFTP 是否可用
4. 读取列表 - 读取 Docker / Compose 项目和当前图标
5. 下载图标库 - 在图标库页面下载默认 HD Icons 或添加自定义图标库
6. 替换图标 - 搜索并选择新图标，或手动填写 URL / 本地路径
7. 同步图标 - 写入 Unraid 模板并刷新目标容器

#### 🖼️ 默认图标库

本工具默认使用 HD Icons 的 `border-radius` 图标集：

- 图标库地址：https://github.com/xushier/HD-Icons
- 默认下载地址：https://github.com/xushier/HD-Icons/archive/refs/heads/main.zip
- 默认读取目录：`HD-Icons-main/border-radius`

图标会在 WebUI 点击下载时按需保存到 `/app/data`，不会内置进镜像。

#### ⚙️ 环境变量

| 变量名 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3149` | WebUI 端口 |
| `NODE_ENV` | `production` | 运行环境 |
| `UNRAID_ICON_SECRET` | 自动生成或手动指定 | 用于加密保存的 SSH 凭据，生产环境建议手动设置长随机字符串 |
| `UNRAID_ICON_STORE_DIR` | `/app/icons` | 容器内图标保存目录 |

#### 📁 路径说明

| 容器路径 | 推荐宿主机路径 | 说明 |
| --- | --- | --- |
| `/app/data` | `/mnt/user/appdata/unraid-icon-manager` | 保存配置、加密凭据和已下载图标库 |
| `/app/icons` | `/mnt/user/appdata/unraid-icon-manager/icons` | 保存从图标库选择后复制出来的图标文件 |

WebUI 里的 `Unraid 本地图标路径` 需要填写 `/app/icons` 对应的宿主机路径，例如：

```text
/mnt/user/appdata/unraid-icon-manager/icons
```

这个路径必须和 Docker volume 映射保持一致，否则 Unraid 可能找不到图标文件。

#### ⚠️ 注意事项

- 为什么不用 Web API：Unraid Web API 更适合读取信息，不能稳定写入 dockerMan 模板、Compose Manager UI Labels 或刷新容器图标 label，所以本工具改为只通过 SSH/SFTP 完成读取、写入、备份和刷新。
- SSH 安全说明：SSH 密码/私钥只保存在当前容器的 `/app/data` 数据目录中，并使用 `UNRAID_ICON_SECRET` 加密；不会上传到外部服务。请保管好数据目录，并把 `UNRAID_ICON_SECRET` 改成自己的长随机字符串。
- 普通 Docker 容器同步后会调用 Unraid dockerMan rebuild 刷新 label，目标容器会短暂停止并重新创建。
- Compose Manager 项目会使用 `docker compose up -d --force-recreate --no-deps` 刷新对应服务。
- 第一次使用建议先选择一个不重要的容器测试。

---

# Unraid Icon Manager

A Node.js based icon manager for Unraid Docker and Compose projects. It can read, preview, replace, and sync icons for dockerMan templates and Compose Manager projects.

#### ✨ Features

- SSH connection - Connects to Unraid with SSH/SFTP only
- Docker icon reading - Reads dockerMan templates, Compose Manager files, and real container status
- Fast icon replacement - Supports URL icons and Unraid local path icons
- Local icon libraries - Download, search, and select icons from local libraries
- Automatic icon copy - Copies selected library icons into the mapped icon directory
- Automatic backup - Backs up template files before writing changes
- Automatic refresh - Refreshes target containers after syncing icons
- Local encryption - SSH credentials are stored only in the local data directory, encrypted
- Docker deployment - Supports Docker and Docker Compose

#### 🚀 Quick Start

##### Docker Compose Recommended

```yaml
services:
  unraid-icon-manager:
    image: javazwz123/unraid-icon-manager:latest
    container_name: unraid-icon-manager
    restart: unless-stopped
    ports:
      - "3149:3149"
    environment:
      PORT: "3149"
      UNRAID_ICON_SECRET: "CHANGE_ME_TO_A_LONG_RANDOM_STRING"
      UNRAID_ICON_STORE_DIR: "/app/icons"
    volumes:
      - /mnt/user/appdata/unraid-icon-manager:/app/data
      - /mnt/user/appdata/unraid-icon-manager/icons:/app/icons
```

Open:

```text
http://YOUR-UNRAID-IP:3149
```

##### Docker Run

```bash
docker run -d \
  --name unraid-icon-manager \
  --restart unless-stopped \
  -p 3149:3149 \
  -e UNRAID_ICON_SECRET="CHANGE_ME_TO_A_LONG_RANDOM_STRING" \
  -e UNRAID_ICON_STORE_DIR="/app/icons" \
  -v /mnt/user/appdata/unraid-icon-manager:/app/data \
  -v /mnt/user/appdata/unraid-icon-manager/icons:/app/icons \
  javazwz123/unraid-icon-manager:latest
```

#### 📖 Basic Usage

1. Open the WebUI - Visit `http://YOUR-UNRAID-IP:3149`
2. Configure SSH - Enter your Unraid SSH host, port, username, and password
3. Test connection - Save settings and verify SSH/SFTP access
4. Load list - Read Docker / Compose projects and current icons
5. Download icon library - Download the default HD Icons library or add your own
6. Replace icons - Search and select a new icon, or manually enter a URL / local path
7. Sync icons - Write changes back to Unraid templates and refresh target containers

#### 🖼️ Default Icon Library

This tool uses the `border-radius` icon set from HD Icons by default:

- Icon library: https://github.com/xushier/HD-Icons
- Default download URL: https://github.com/xushier/HD-Icons/archive/refs/heads/main.zip
- Default subdirectory: `HD-Icons-main/border-radius`

Icons are downloaded on demand from the WebUI and saved under `/app/data`; they are not bundled into the image.

#### ⚙️ Environment Variables

| Name | Default | Description |
| --- | --- | --- |
| `PORT` | `3149` | WebUI port |
| `NODE_ENV` | `production` | Runtime environment |
| `UNRAID_ICON_SECRET` | auto-generated or custom | Encrypts saved SSH credentials. Use a long random value in production |
| `UNRAID_ICON_STORE_DIR` | `/app/icons` | Container path used to store selected local icon files |

#### 📁 Paths

| Container path | Recommended host path | Description |
| --- | --- | --- |
| `/app/data` | `/mnt/user/appdata/unraid-icon-manager` | App config, encrypted credentials, and downloaded icon libraries |
| `/app/icons` | `/mnt/user/appdata/unraid-icon-manager/icons` | Icon files copied from the local icon library |

In the WebUI, set `Unraid local icon path` to the host path mapped to `/app/icons`, for example:

```text
/mnt/user/appdata/unraid-icon-manager/icons
```

This path must match your Docker volume mapping, otherwise Unraid may not be able to load the icon files.

#### ⚠️ Notes

- Why not use the Web API: the Unraid Web API is better for reading data, but it cannot reliably update dockerMan templates, Compose Manager UI Labels, or refresh container icon labels. This tool uses SSH/SFTP for reading, writing, backup, and refresh.
- SSH security note: SSH passwords/private keys are stored only in the container data directory `/app/data`, encrypted with `UNRAID_ICON_SECRET`; they are never uploaded to an external service. Protect your data directory and change `UNRAID_ICON_SECRET` to your own long random string.
- For normal Docker containers, syncing uses Unraid dockerMan rebuild to refresh labels. The target container will briefly stop and be recreated.
- For Compose Manager projects, syncing recreates the target service with `docker compose up -d --force-recreate --no-deps`.
- For first use, test with a non-critical container.
