#!/usr/bin/env python3
"""
Linux 图标集生成器 (hicolor 尺寸集)

背景:
  electron-builder 的 `linux.icon` 若指向**单个 PNG 文件**, app-builder 的 icon 工具
  会返回 size=0 (单文件没有尺寸信息), FpmTarget 随后把它装到
  `/usr/share/icons/hicolor/0x0/apps/<name>.png` —— 0x0 不是合法图标目录,
  桌面环境按图标主题规范查找时找不到, 于是 deb 安装后应用没有图标 (显示通用图标)。

  正确做法: `linux.icon` 指向一个**目录**, 目录内放 `<size>x<size>.png` 命名的文件,
  app-builder 即可从文件名解析尺寸, 逐个装到 hicolor/<size>x<size>/apps/。

用法:
  pip install pillow
  python3 scripts/gen-linux-icons.py
  # 或 npm run gen-icons

产出:
  build/icons/{16,24,32,48,64,128,256,512}x<size>.png   ← 供 electron-builder 使用
  src/renderer/public/icon.png                            ← 256 (窗口图标 / vite publicDir) 同步刷新
"""
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("需要 Pillow: pip install pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src/renderer/assets/logo-512.png")
OUT_DIR = os.path.join(ROOT, "build/icons")
PUBLIC_ICON = os.path.join(ROOT, "src/renderer/public/icon.png")

SIZES = [16, 24, 32, 48, 64, 128, 256, 512]


def main():
    if not os.path.isfile(SRC):
        sys.exit("找不到源图: %s" % SRC)

    os.makedirs(OUT_DIR, exist_ok=True)
    base = Image.open(SRC).convert("RGBA")

    for size in SIZES:
        # LANCZOS 缩放; reducing_gap 抑制大比例缩小时的振铃
        resized = base.resize((size, size), Image.LANCZOS, reducing_gap=3.0)
        out = os.path.join(OUT_DIR, "%dx%d.png" % (size, size))
        resized.save(out, "PNG", optimize=True)
        print("生成 %s (%dx%d)" % (os.path.relpath(out, ROOT), size, size))

    # 窗口图标 / vite publicDir 用 256 版本, 与图标集保持同一渲染结果
    base.resize((256, 256), Image.LANCZOS, reducing_gap=3.0).save(PUBLIC_ICON, "PNG", optimize=True)
    print("刷新 %s (256x256)" % os.path.relpath(PUBLIC_ICON, ROOT))


if __name__ == "__main__":
    main()
