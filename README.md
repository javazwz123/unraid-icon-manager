# Unraid Icon Manager

这是一个本地运行的 Web 工具，用来管理 Unraid Docker / Compose 项目的图标。

## 当前能力

- 只通过 SSH/SFTP 连接 Unraid。
- 通过 SSH 执行 `docker inspect` 读取真实容器状态、镜像和 Compose labels。
- 读取 Docker 模板 XML：`/boot/config/plugins/dockerMan/templates-user`。
- 读取 Compose Manager 项目：`/boot/config/plugins/compose.manager/projects`。
- 修改普通 Docker 模板的 `<Icon>`。
- 修改 Compose Manager 的 `net.unraid.docker.icon`。
- 同步前自动创建远端 `.bak` 备份。
- 同步后刷新对应容器：普通 Docker 使用 dockerMan rebuild 重新创建容器以刷新 label，Compose 服务使用 recreate。
- 本地加密保存 SSH 凭据。
- 支持多个本地图标库一起搜索和选择。
- 从本地图标库选择图标时，复制到 Docker 映射的图标目录，并写入 Unraid 宿主机本地路径。

## 连接说明

Web/API 已不再用于主流程，因为它不能稳定替换 Docker 图标模板。本工具现在只需要 SSH/SFTP。

SSH 用户需要能读取 Docker 状态，并能访问这些路径：

```text
/boot/config/plugins/dockerMan/templates-user
/boot/config/plugins/compose.manager/projects
```

## 本地图标库

默认不会随项目一起下载图标库，按需在界面里点击下载。

默认图标库：

```text
名称: HD Icons
内部 ID: hd-icons-border-radius
Zip: https://github.com/xushier/HD-Icons/archive/refs/heads/main.zip
目录: HD-Icons-main/border-radius
```

下载后的图标会保存在：

```text
data/icon-libraries/<library-id>/
```

选择本地图标后，程序会把图标复制到容器内图标目录：

```text
/app/icons
```

这个目录需要映射到 Unraid 宿主机，例如：

```text
/mnt/user/appdata/unraid-icon-manager/icons:/app/icons
```

WebUI 里的 `Unraid 本地图标路径` 默认是：

```text
/mnt/user/appdata/unraid-icon-manager/icons
```

从本地图标库选择图标后，最终写入 Unraid 的值会类似：

```text
/mnt/user/appdata/unraid-icon-manager/icons/plex-xxxxxxxxxx.png
```

## 本地运行

```powershell
npm.cmd install
npm.cmd start
```

默认地址：

```text
http://localhost:3149
```

## Docker 运行

构建并启动：

```powershell
docker compose up -d --build
```

默认端口：

```text
http://localhost:3149
```

数据会挂载到：

```text
./data:/app/data
./icons:/app/icons
```

在 Unraid 上使用时，建议把 `docker-compose.yml` 里的 `UNRAID_ICON_SECRET` 改成自己的长随机字符串，并把图标目录映射到宿主机固定路径：

```text
/mnt/user/appdata/unraid-icon-manager/icons:/app/icons
```

如果不想用 compose，也可以直接运行：

```powershell
docker build -t unraid-icon-manager:local .
docker run -d --name unraid-icon-manager --restart unless-stopped -p 3149:3149 -e UNRAID_ICON_SECRET=change-this-secret -e UNRAID_ICON_STORE_DIR=/app/icons -v ${PWD}/data:/app/data -v ${PWD}/icons:/app/icons unraid-icon-manager:local
```

### Unraid 部署提示

如果在 Unraid 本机上构建：

```bash
cd /mnt/user/appdata/unraid-icon-manager-src
docker build -t unraid-icon-manager:local .
docker run -d --name unraid-icon-manager --restart unless-stopped \
  -p 3149:3149 \
  -e UNRAID_ICON_SECRET="change-this-secret" \
  -e UNRAID_ICON_STORE_DIR="/app/icons" \
  -v /mnt/user/appdata/unraid-icon-manager:/app/data \
  -v /mnt/user/appdata/unraid-icon-manager/icons:/app/icons \
  unraid-icon-manager:local
```

也可以参考 `unraid-template.xml` 创建 Docker 模板。当前镜像名是本地构建用的 `unraid-icon-manager:local`；后续推送到镜像仓库后，把模板里的 `Repository` 改成实际镜像名即可。

## 验证

```powershell
npm.cmd test
```

## Local path icon preview

The WebUI previews local path icons in two ways:

- Paths under `Unraid local icon path` are mapped to the container icon directory, such as `/app/icons`.
- Paths outside that mapped directory must be added to `SSH icon preview allowlist` in advanced settings. The app will then read only those allowed image files through SSH/SFTP.

Example allowlist entry:

```text
/boot/config/plugins/dockerMan/images
```

The allowlist is only for preview. Supported image extensions are `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`, and `.ico`.
