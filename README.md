# Unraid Icon Manager

一个用于 Unraid 的 Docker / Compose 图标管理工具。

它通过 SSH 读取 Unraid 上的 Docker 状态、dockerMan 模板和 Compose Manager 配置，让你可以在一个 Web 页面里搜索、预览、替换和同步容器图标。

## 功能

- 通过 SSH/SFTP 连接 Unraid
- 读取 Docker 容器状态和图标信息
- 支持普通 Docker 模板和 Compose Manager 项目
- 支持 URL 图标和 Unraid 本地路径图标
- 支持下载并搜索本地图标库
- 从图标库选择图标后自动复制到映射目录
- 同步前自动备份原始模板
- 同步后自动刷新目标容器图标
- SSH 凭据只保存在本地数据目录，并加密存储

## Docker 部署

```bash
docker run -d \
  --name unraid-icon-manager \
  --restart unless-stopped \
  -p 3149:3149 \
  -e UNRAID_ICON_SECRET="change-this-secret" \
  -e UNRAID_ICON_STORE_DIR="/app/icons" \
  -v /mnt/user/appdata/unraid-icon-manager:/app/data \
  -v /mnt/user/appdata/unraid-icon-manager/icons:/app/icons \
  your-dockerhub-username/unraid-icon-manager:latest
```

打开：

```text
http://你的Unraid-IP:3149
```

建议把 `UNRAID_ICON_SECRET` 改成自己的长随机字符串。

## Docker Compose

```yaml
services:
  unraid-icon-manager:
    image: your-dockerhub-username/unraid-icon-manager:latest
    container_name: unraid-icon-manager
    restart: unless-stopped
    ports:
      - "3149:3149"
    environment:
      PORT: "3149"
      UNRAID_ICON_SECRET: "change-this-secret"
      UNRAID_ICON_STORE_DIR: "/app/icons"
    volumes:
      - /mnt/user/appdata/unraid-icon-manager:/app/data
      - /mnt/user/appdata/unraid-icon-manager/icons:/app/icons
```

## 路径说明

`/app/data` 用于保存配置、加密凭据和已下载的图标库。

`/app/icons` 用于保存从本地图标库选择后复制出来的图标文件。

WebUI 里的 `Unraid 本地图标路径` 需要填写宿主机路径，默认：

```text
/mnt/user/appdata/unraid-icon-manager/icons
```

这个路径必须和 `/app/icons` 的 Docker 映射对应，否则 Unraid 可能找不到图标文件。

## 使用步骤

1. 启动容器并打开 WebUI
2. 填写 Unraid SSH 地址、端口、用户名和密码
3. 保存设置并测试连接
4. 读取 Docker 列表
5. 下载或配置图标库
6. 选择新图标并同步

## 注意

- 本工具只通过 SSH/SFTP 工作，不需要 Unraid Web API。
- 普通 Docker 图标同步后会调用 Unraid dockerMan 的 rebuild 脚本刷新 label，目标容器会短暂停止并重新创建。
- Compose Manager 项目会通过 `docker compose up -d --force-recreate --no-deps` 刷新对应服务。
- 第一次使用建议先选择一个不重要的容器测试。

---

# Unraid Icon Manager

A simple web tool for managing Docker and Compose icons on Unraid.

It connects to Unraid through SSH, reads Docker status, dockerMan templates, and Compose Manager files, then lets you search, preview, replace, and sync container icons from one clean Web UI.

## Features

- Connect to Unraid with SSH/SFTP
- Read Docker container status and icon values
- Support dockerMan templates and Compose Manager projects
- Support URL icons and Unraid local path icons
- Download and search local icon libraries
- Copy selected library icons into a mapped icon directory
- Backup template files before writing changes
- Refresh target containers after syncing icons
- Store SSH credentials only in the local data directory, encrypted

## Docker Run

```bash
docker run -d \
  --name unraid-icon-manager \
  --restart unless-stopped \
  -p 3149:3149 \
  -e UNRAID_ICON_SECRET="change-this-secret" \
  -e UNRAID_ICON_STORE_DIR="/app/icons" \
  -v /mnt/user/appdata/unraid-icon-manager:/app/data \
  -v /mnt/user/appdata/unraid-icon-manager/icons:/app/icons \
  your-dockerhub-username/unraid-icon-manager:latest
```

Open:

```text
http://YOUR-UNRAID-IP:3149
```

Change `UNRAID_ICON_SECRET` to your own long random string.

## Docker Compose

```yaml
services:
  unraid-icon-manager:
    image: your-dockerhub-username/unraid-icon-manager:latest
    container_name: unraid-icon-manager
    restart: unless-stopped
    ports:
      - "3149:3149"
    environment:
      PORT: "3149"
      UNRAID_ICON_SECRET: "change-this-secret"
      UNRAID_ICON_STORE_DIR: "/app/icons"
    volumes:
      - /mnt/user/appdata/unraid-icon-manager:/app/data
      - /mnt/user/appdata/unraid-icon-manager/icons:/app/icons
```

## Path Notes

`/app/data` stores app config, encrypted credentials, and downloaded icon libraries.

`/app/icons` stores selected local icons copied from the icon library.

In the WebUI, set `Unraid local icon path` to the host path mapped to `/app/icons`. Default:

```text
/mnt/user/appdata/unraid-icon-manager/icons
```

This host path must match the Docker volume mapping, otherwise Unraid may not be able to load the icon files.

## How To Use

1. Start the container and open the WebUI
2. Enter your Unraid SSH host, port, username, and password
3. Save settings and test the connection
4. Load the Docker list
5. Download or configure an icon library
6. Pick new icons and sync them back to Unraid

## Notes

- This tool works through SSH/SFTP only. It does not need the Unraid Web API.
- For normal Docker containers, syncing uses Unraid dockerMan rebuild to refresh labels. The target container will briefly stop and be recreated.
- For Compose Manager projects, syncing recreates the target service with `docker compose up -d --force-recreate --no-deps`.
- For first use, test with a non-critical container.
