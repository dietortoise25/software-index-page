#!/usr/bin/env bash
#
# deploy-full.sh — 软件发布站完整部署脚本（服务器端构建）
#
# 用法：
#   bash scripts/deploy-full.sh               # 部署全部（前端+后端+退货工作流）
#   bash scripts/deploy-full.sh --frontend     # 仅前端
#   bash scripts/deploy-full.sh --server       # 仅审查API
#   bash scripts/deploy-full.sh --rw           # 仅退货工作流
#
# 前置条件：
#   - .env 文件已配置
#   - SSH 密钥已加载：eval $(ssh-agent) && ssh-add ~/.ssh/alan_pc.pem

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERR]${NC}   $*" >&2; exit 1; }

# ── 读取 .env ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    err "找不到 .env 文件，请先创建: cp .env.example .env"
fi

# 安全解析：逐变量 grep，避免 source 时含空格行导致 bash 报错
env_val() {
    local key="$1"
    local default="${2:-}"
    local val
    val=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-)
    val=$(echo "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    echo "${val:-$default}"
}

SERVER_USER="$(env_val SERVER_USER)"
SERVER_IP="$(env_val SERVER_IP)"
SERVER_PORT="$(env_val SERVER_PORT 22)"
SSH_KEY_PATH="$(env_val SSH_KEY_PATH)"

# ── 参数 ──
DEPLOY_FRONTEND=false
DEPLOY_SERVER=false
DEPLOY_RW=false

case "${1:-}" in
    --frontend) DEPLOY_FRONTEND=true ;;
    --server)   DEPLOY_SERVER=true ;;
    --rw)       DEPLOY_RW=true ;;
    ""|--all)   DEPLOY_FRONTEND=true; DEPLOY_SERVER=true; DEPLOY_RW=true ;;
    *)          err "未知参数: $1，可用: --frontend | --server | --rw | --all" ;;
esac

# ── 连接检查 ──
SSH_TARGET="${SERVER_USER}@${SERVER_IP}"
SSH_PORT="${SERVER_PORT}"
REMOTE_BUILD="/tmp/software-index-build"

log "检查连接 $SSH_TARGET..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes -p "$SSH_PORT" "$SSH_TARGET" "echo OK" &>/dev/null; then
    err "无法连接到 $SSH_TARGET:$SSH_PORT，请先加载 SSH 密钥"
fi
log "连接成功"

# ── 打包源文件 ──
PACK_DIR="$PROJECT_DIR/.deploy-tmp"
rm -rf "$PACK_DIR"
mkdir -p "$PACK_DIR"

# 打包函数：将指定文件列表打包为 tar.gz
pack_files() {
    local name="$1"
    local dest="$PACK_DIR/${name}.tar.gz"
    shift
    log "打包 $name ..."
    cd "$PROJECT_DIR"
    tar czf "$dest" "$@" 2>/dev/null
    echo "$dest"
}

if $DEPLOY_FRONTEND; then
    pack_files "frontend" \
        src \
        index.html \
        vite.config.ts \
        tsconfig.json tsconfig.app.json tsconfig.node.json \
        package.json pnpm-lock.yaml \
        components.json \
        vercel.json \
        posts
fi

if $DEPLOY_SERVER; then
    pack_files "server" \
        server/src \
        server/package.json server/pnpm-lock.yaml server/tsconfig.json
fi

if $DEPLOY_RW; then
    pack_files "rw" \
        tools/return-workflow/src \
        tools/return-workflow/package.json \
        tools/return-workflow/pnpm-lock.yaml \
        tools/return-workflow/tsconfig.json \
        tools/return-workflow/data_example
fi

# ── 上传 ──
log "创建远程构建目录..."
ssh -p "$SSH_PORT" "$SSH_TARGET" "rm -rf '$REMOTE_BUILD' && mkdir -p '$REMOTE_BUILD'"

for tgz in "$PACK_DIR"/*.tar.gz; do
    [ -f "$tgz" ] || continue
    log "上传 $(basename "$tgz") ..."
    scp -P "$SSH_PORT" "$tgz" "$SSH_TARGET:$REMOTE_BUILD/"
done

# ── 服务器端构建 ──
ssh -p "$SSH_PORT" "$SSH_TARGET" << 'BUILDSCRIPT'
set -e

REMOTE_BUILD="/tmp/software-index-build"
DEPLOY_BASE="/var/www/software-index"

export PATH="$PATH:/usr/local/bin"

# ── 前端构建 ──
if [ -f "$REMOTE_BUILD/frontend.tar.gz" ]; then
    echo "━━━ 构建前端 ━━━"
    cd "$REMOTE_BUILD"
    rm -rf frontend-src
    mkdir frontend-src
    tar xzf frontend.tar.gz -C frontend-src
    cd frontend-src
    pnpm install --frozen-lockfile
    npx vite build
    echo "部署前端到 $DEPLOY_BASE ..."
    cp dist/index.html "$DEPLOY_BASE/"
    cp dist/favicon.svg "$DEPLOY_BASE/" 2>/dev/null || true
    rm -rf "$DEPLOY_BASE/assets"
    cp -r dist/assets "$DEPLOY_BASE/"
    echo "前端构建完成"
fi

# ── 审查API构建 ──
if [ -f "$REMOTE_BUILD/server.tar.gz" ]; then
    echo "━━━ 构建审查API ━━━"
    cd "$REMOTE_BUILD"
    rm -rf server-src
    mkdir server-src
    tar xzf server.tar.gz -C server-src
    cd server-src/server
    pnpm install --frozen-lockfile
    npx tsc
    echo "部署 server 到 $DEPLOY_BASE/server/dist ..."
    mkdir -p "$DEPLOY_BASE/server/dist"
    cp -r dist/* "$DEPLOY_BASE/server/dist/"
    cp package.json "$DEPLOY_BASE/server/"
    cd "$DEPLOY_BASE/server"
    pnpm install --frozen-lockfile --prod 2>/dev/null || npm install --omit=dev
    echo "审查API构建完成"
    sudo systemctl restart relay
fi

# ── 退货工作流构建 ──
if [ -f "$REMOTE_BUILD/rw.tar.gz" ]; then
    echo "━━━ 构建退货工作流 ━━━"
    cd "$REMOTE_BUILD"
    rm -rf rw-src
    mkdir rw-src
    tar xzf rw.tar.gz -C rw-src
    cd rw-src/tools/return-workflow
    pnpm install --frozen-lockfile
    npx tsc
    echo "部署 return-workflow..."
    RW_DIR="$DEPLOY_BASE/tools/return-workflow"
    mkdir -p "$RW_DIR/dist" "$RW_DIR/data_example"
    cp -r dist/* "$RW_DIR/dist/"
    cp -r data_example/* "$RW_DIR/data_example/" 2>/dev/null || true
    cp package.json "$RW_DIR/"
    cd "$RW_DIR"
    pnpm install --frozen-lockfile --prod 2>/dev/null || npm install --omit=dev
    if [ ! -f "$RW_DIR/.env" ]; then
      cat > "$RW_DIR/.env" << ENVEOF
FEISHU_APP_ID=cli_a9646f769479dbd4
FEISHU_APP_SECRET=NQomqTYaZHapPxb3uDf6HbantJLyOLwQ
PORT=3002
ENVEOF
      echo ".env 已创建（首次）"
    fi
    if [ ! -f "$RW_DIR/config.json" ]; then
      echo '{}' > "$RW_DIR/config.json"
      echo "config.json 已创建（首次）"
    fi
    echo "退货工作流构建完成"
    sudo systemctl restart return-workflow
fi

echo ""
echo "清理构建临时文件..."
rm -rf "$REMOTE_BUILD"
echo "全部构建完成"
BUILDSCRIPT

# ── 本地清理 ──
rm -rf "$PACK_DIR"

echo ""
echo "=============================================="
echo -e "${GREEN}部署完成${NC}"
echo "=============================================="

# ── 快速验证 ──
log "验证服务状态..."
sleep 2

check_url() {
    local url="$1"
    local label="$2"
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    if [ "$code" = "200" ]; then
        echo -e "  ${GREEN}✓${NC} $label ($code)"
    else
        echo -e "  ${RED}✗${NC} $label ($code)"
    fi
}

check_url "http://${SERVER_IP}/" "前端首页"
check_url "http://${SERVER_IP}/return-workflow" "退货工作流页面"

if $DEPLOY_SERVER; then
    check_url "http://${SERVER_IP}/api/verify-pin" "API (verify-pin POST)" || true
fi

if $DEPLOY_RW; then
    check_url "http://${SERVER_IP}/api/return-workflow/health" "退货工作流 API"
fi

echo ""
log "服务器端验证命令:"
echo "  ssh $SSH_TARGET 'sudo systemctl status relay return-workflow --no-pager'"
