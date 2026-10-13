#!/usr/bin/env bash
# Hundun Lite 启动脚本 (Linux / macOS)
# 用法: ./start.sh
set -euo pipefail

# 无论从哪个目录调用，都切到脚本所在目录（相对路径解析，不写死绝对路径）
cd "$(cd "$(dirname "$0")" && pwd)"

# node 不在 PATH 时，回退尝试常见用户级安装位置
if ! command -v node >/dev/null 2>&1; then
  for d in "$HOME/.local/node/bin" "$HOME"/.nvm/versions/node/*/bin; do
    if [ -x "$d/node" ]; then
      export PATH="$d:$PATH"
      break
    fi
  done
fi

if ! command -v node >/dev/null 2>&1; then
  echo "错误: 找不到 node，请先安装 Node.js >= 16" >&2
  exit 1
fi

# 依赖缺失时自动安装（首次克隆后无需手动 npm install）
if [ ! -d node_modules ]; then
  echo "首次运行，安装依赖..."
  npm install --no-audit --no-fund
fi

# Linux: chrome-sandbox 需要 root 设 SUID 4755，且 AppArmor 限制非特权 user namespace。
# 无 root 时 Electron 会直接 FATAL 退出，只能关沙箱；已正确设 SUID 则保留沙箱。
args=()
if [ "$(uname -s)" = "Linux" ]; then
  sandbox_bin="node_modules/electron/dist/chrome-sandbox"
  if [ -f "$sandbox_bin" ] && [ -u "$sandbox_bin" ]; then
    echo "chrome-sandbox 已设 SUID，保留沙箱运行"
  else
    echo "提示: 未设 SUID 的 chrome-sandbox，使用 --noSandbox 运行"
    echo "      (可选: sudo chown root:root $sandbox_bin && sudo chmod 4755 $sandbox_bin)"
    args+=(--noSandbox)
  fi
fi

exec npm run dev -- "${args[@]}"
