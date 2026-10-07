    // ========== Script Executor ==========
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    const os = require('os');

    /**
     * 运行包装器 (纯 ASCII, 路径全部走参数 → 规避中文/空格路径的编码与引号问题)
     * 作用:
     *  1. 分发 .ps1 (powershell) / .bat .cmd (call)
     *  2. 延迟展开写入真实退出码到退出码文件
     *     (cmd 缺陷: `echo %errorlevel%>file` 展开为空, 必须用 !errorlevel!)
     * 启动链: cmd /c start "" /wait cmd /c <wrapper> <script> <exitfile>
     *  - start /wait → 新控制台窗口 (pause 可交互阻塞, 输出可见)
     *  - 外层退出码恒 0 (start 不传播), 真实退出码读退出码文件
     */
    const WRAPPER_PATH = path.join(os.tmpdir(), 'fastcmd-run-wrapper.bat');
    const WRAPPER_CONTENT = [
      '@echo off',
      'setlocal enabledelayedexpansion',
      'if /i "%~x1"==".ps1" (',
      '  powershell -NoProfile -ExecutionPolicy Bypass -File %1',
      ') else (',
      '  call %1',
      ')',
      'echo !errorlevel!>"%~2"',
      '',
    ].join('\r\n');

    const ensureWrapper = () => {
      try {
        if (!fs.existsSync(WRAPPER_PATH) || fs.readFileSync(WRAPPER_PATH, 'utf8') !== WRAPPER_CONTENT) {
          fs.writeFileSync(WRAPPER_PATH, WRAPPER_CONTENT, 'ascii');
        }
      } catch (err) {
        console.error('[FastCmd] ensureWrapper error:', err);
      }
    };

    /**
     * .ps1 编码守卫 (bug 2026-10-04: 中文 ps1 报"意外的标记")
     * 根因: Windows PowerShell 5.1 的 -File 在无 BOM 时按系统 ANSI(GBK) 读脚本,
     *       UTF-8 中文脚本被按 GBK 解码 → 乱码 + 引号配对被破坏 → 解析错误。
     * 处理: 无 BOM + 含非 ASCII + 严格 UTF-8 校验通过 → 就地补 3 字节 UTF-8 BOM;
     *       纯 ASCII (两种编码等价) / 已有 BOM / 非 UTF-8 (GBK 文件 PS 按 ANSI 读本就正确) → 不动。
     * 失败 (只读/被占用) 不阻断执行, best effort。
     */
    const ensurePs1Bom = (absPath) => {
      try {
        if (path.extname(absPath).toLowerCase() !== '.ps1') return;
        const buf = fs.readFileSync(absPath);
        if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return;
        let nonAscii = false;
        for (let i = 0; i < buf.length; i++) {
          if (buf[i] >= 0x80) { nonAscii = true; break; }
        }
        if (!nonAscii) return;
        try {
          new TextDecoder('utf-8', { fatal: true }).decode(buf);
        } catch (_) {
          return; // 非 UTF-8 (如 GBK): 保持原样
        }
        const out = Buffer.alloc(buf.length + 3);
        out[0] = 0xef; out[1] = 0xbb; out[2] = 0xbf;
        buf.copy(out, 3);
        fs.writeFileSync(absPath, out);
        console.log('[FastCmd] .ps1 UTF-8 无 BOM → 已补 BOM:', absPath);
      } catch (err) {
        console.error('[FastCmd] ensurePs1Bom error:', err);
      }
    };

    /**
     * 相对路径 → 数据目录绝对路径 (经 preload getBasePath)
     */
    const resolveScriptAbsPath = async (relPath) => {
      const api = window.hundun && window.hundun.fs;
      if (!api || !api.getBasePath) return null;
      try {
        const base = await api.getBasePath();
        if (!base) return null;
        return path.join(base, ...String(relPath || '').split('/').filter(Boolean));
      } catch (err) {
        console.error('[FastCmd] resolveScriptAbsPath error:', err);
        return null;
      }
    };

    /**
     * 真实执行脚本 (绝对路径)
     * @param {string} absPath 脚本绝对路径
     * @param {{onStarted?: Function}} [handlers] spawn 成功即回调 (不等脚本结束)
     * @returns {Promise<{ok:boolean, code:number|null, error:string|null}>} 脚本退出后 resolve
     */
    const executeScript = (absPath, handlers = {}) => {
      ensurePs1Bom(absPath);
      ensureWrapper();
      const exitFile = path.join(os.tmpdir(), `fastcmd-exit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.txt`);

      return new Promise((resolve) => {
        let child;
        const t0 = Date.now();
        try {
          child = spawn('cmd.exe',
            ['/c', 'start', '', '/wait', 'cmd.exe', '/c', WRAPPER_PATH, absPath, exitFile],
            {
              cwd: path.dirname(absPath),
              stdio: 'ignore',
              windowsHide: false,
              shell: false,
              detached: true,
            });
        } catch (err) {
          resolve({ ok: false, code: null, error: err.message });
          return;
        }

        let settled = false;
        const settle = (result) => {
          if (settled) return;
          settled = true;
          // 清理退出码文件
          try { if (fs.existsSync(exitFile)) fs.unlinkSync(exitFile); } catch (_) {}
          resolve(result);
        };

        child.on('spawn', () => {
          if (handlers.onStarted) handlers.onStarted();
        });
        child.on('error', (err) => {
          settle({ ok: false, code: null, error: err.message });
        });
        child.on('exit', () => {
          let code = null;
          let error = null;
          try {
            if (fs.existsSync(exitFile)) {
              const raw = fs.readFileSync(exitFile, 'utf8').trim();
              const n = parseInt(raw, 10);
              if (!Number.isNaN(n)) code = n;
              else error = `invalid exit file: ${JSON.stringify(raw)}`;
            } else {
              error = 'exit file missing (window closed early?)';
            }
          } catch (err) {
            error = err.message;
          }
          settle({ ok: code === 0, code, error });
        });

        // 兜底: 30 分钟未结束视为仍在运行, 不再等待 (脚本可继续跑, 只是不回报退出码)
        setTimeout(() => settle({ ok: true, code: null, error: null, running: true }), 30 * 60 * 1000);
        try { child.unref(); } catch (_) {}
      });
    };

    /**
     * 在系统默认编辑器中打开脚本 (edit 动词, 不执行)
     * 注意: shell.openPath 对 .bat 是 open 动词 = 直接运行, 不能用!
     */
    const openInSystemEditor = (absPath) => {
      try {
        const child = spawn('powershell.exe', [
          '-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-Command',
          `Start-Process -LiteralPath $env:FASTCMD_EDIT_TARGET -Verb Edit`,
        ], {
          stdio: 'ignore',
          shell: false,
          windowsHide: true,
          detached: true,
          env: Object.assign({}, process.env, { FASTCMD_EDIT_TARGET: absPath }),
        });
        let spawned = false;
        child.on('spawn', () => { spawned = true; });
        child.on('error', (err) => console.error('[FastCmd] openInSystemEditor error:', err));
        setTimeout(() => { try { if (spawned) child.unref(); } catch (_) {} }, 500);
        return true;
      } catch (err) {
        console.error('[FastCmd] openInSystemEditor error:', err);
        return false;
      }
    };

    /**
     * 获取脚本文件信息 (需传绝对路径)
     */
    const getScriptInfo = (absPath) => {
      try {
        const stat = fs.statSync(absPath);
        const ext = path.extname(absPath).toLowerCase();
        return {
          size: stat.size,
          modified: stat.mtime,
          type: ext === '.ps1' ? 'PowerShell' : 'Batch',
          encoding: ext === '.ps1' ? 'UTF-8' : 'GBK/UTF-8',
        };
      } catch (err) {
        return null;
      }
    };
