    // ========== Script Executor ==========
    const { spawn, spawnSync } = require('child_process');
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
     * 真实执行脚本 (绝对路径) — Windows 分支
     * @param {string} absPath 脚本绝对路径
     * @param {{onStarted?: Function}} [handlers] spawn 成功即回调 (不等脚本结束)
     * @returns {Promise<{ok:boolean, code:number|null, error:string|null}>} 脚本退出后 resolve
     */
    const executeScriptWindows = (absPath, handlers = {}) => {
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

    // ========== Linux 执行链 (.sh) ==========

    const shQuote = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

    /**
     * 每次运行生成独立 wrapper (POSIX sh, 路径内联 → 规避终端 CLI 引号/转义差异):
     *  1. cd 到脚本目录 (脚本内相对路径成立)
     *  2. 有执行位 → 直接执行 (尊重 shebang; 无 shebang 的 ENOEXEC 由 sh 回退按 shell 脚本跑)
     *     无执行位 → sh 执行
     *  3. 退出码写入退出码文件 (经终端模拟器启动时拿不到子进程退出码, 只能回读文件)
     */
    const buildLinuxWrapper = (scriptPath, exitFile) => [
      '#!/bin/sh',
      `s=${shQuote(scriptPath)}`,
      `e=${shQuote(exitFile)}`,
      'cd "$(dirname "$s")" || { printf 127 > "$e"; exit 127; }',
      'if [ -x "$s" ]; then "$s"; else sh "$s"; fi',
      'code=$?',
      'printf %s "$code" > "$e"',
      'exit $code',
      '',
    ].join('\n');

    // 终端模拟器候选 (按优先级), args = 组装给 spawn 的 argv
    const LINUX_TERMINALS = [
      { cmd: 'gnome-terminal', args: (w) => ['--wait', '--', 'sh', w] },
      { cmd: 'konsole', args: (w) => ['-e', 'sh', w] },
      { cmd: 'xfce4-terminal', args: (w) => ['-e', `sh ${shQuote(w)}`] },
      { cmd: 'tilix', args: (w) => ['-e', `sh ${shQuote(w)}`] },
      { cmd: 'kitty', args: (w) => ['sh', w] },
      { cmd: 'alacritty', args: (w) => ['-e', 'sh', w] },
      { cmd: 'terminator', args: (w) => ['-e', `sh ${shQuote(w)}`] },
      { cmd: 'xterm', args: (w) => ['-e', 'sh', w] },
      { cmd: 'urxvt', args: (w) => ['-e', 'sh', w] },
      { cmd: 'x-terminal-emulator', args: (w) => ['-e', 'sh', w] },
    ];

    let _linuxTerminal; // undefined=未探测, null=无终端
    const detectLinuxTerminal = () => {
      if (_linuxTerminal !== undefined) return _linuxTerminal;
      _linuxTerminal = null;
      for (const t of LINUX_TERMINALS) {
        try {
          const r = spawnSync('sh', ['-c', `command -v ${t.cmd} >/dev/null 2>&1`]);
          if (r.status === 0) { _linuxTerminal = t; break; }
        } catch (_) { /* next candidate */ }
      }
      if (!_linuxTerminal) console.warn('[FastCmd] Linux 未找到终端模拟器, 改为后台直接执行 (输出不可见)');
      return _linuxTerminal;
    };

    /**
     * 真实执行 .sh (绝对路径) — Linux 分支
     * 首选: 探测终端模拟器打开可见窗口跑 wrapper, 轮询退出码文件 (对应 Windows 的可见控制台)
     * 回退: 无终端/终端启动失败 → 后台直接跑 wrapper, 用子进程退出码 (输出不可见)
     * @returns {Promise<{ok:boolean, code:number|null, error:string|null, running?:boolean}>}
     */
    const executeScriptLinux = (absPath, handlers = {}) => {
      const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const exitFile = path.join(os.tmpdir(), `fastcmd-exit-${uniq}.txt`);
      const wrapperPath = path.join(os.tmpdir(), `fastcmd-run-${uniq}.sh`);

      try {
        fs.writeFileSync(wrapperPath, buildLinuxWrapper(absPath, exitFile), 'utf8');
      } catch (err) {
        return Promise.resolve({ ok: false, code: null, error: err.message });
      }

      return new Promise((resolve) => {
        let settled = false;
        let pollTimer = null;
        let guardTimer = null;
        let fallbackUsed = false;

        const cleanup = () => {
          if (pollTimer) clearInterval(pollTimer);
          if (guardTimer) clearTimeout(guardTimer);
          try { if (fs.existsSync(wrapperPath)) fs.unlinkSync(wrapperPath); } catch (_) {}
          try { if (fs.existsSync(exitFile)) fs.unlinkSync(exitFile); } catch (_) {}
        };
        const settle = (result) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(result);
        };
        const readExitFile = () => {
          try {
            const raw = fs.readFileSync(exitFile, 'utf8').trim();
            const code = parseInt(raw, 10);
            if (Number.isNaN(code)) settle({ ok: false, code: null, error: `invalid exit file: ${JSON.stringify(raw)}` });
            else settle({ ok: code === 0, code, error: null });
          } catch (err) {
            settle({ ok: false, code: null, error: err.message });
          }
        };
        const armGuard = () => {
          // 兜底: 30 分钟未结束视为仍在运行 (脚本继续跑, 只是不回报退出码)
          guardTimer = setTimeout(() => settle({ ok: true, code: null, error: null, running: true }), 30 * 60 * 1000);
        };
        // 终端路径: 退出码文件异步回读 (脚本可长时间运行, 每 300ms 轮询)
        const startExitPolling = () => {
          pollTimer = setInterval(() => {
            if (fs.existsSync(exitFile)) readExitFile();
          }, 300);
          armGuard();
        };
        // 回退: 无终端/终端失败 → 后台直接执行 (stdio:ignore, 退出码取子进程)
        const runDirect = () => {
          if (settled || fallbackUsed) return;
          fallbackUsed = true;
          if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
          let child;
          try {
            child = spawn('sh', [wrapperPath], { cwd: path.dirname(absPath), stdio: 'ignore', detached: true });
          } catch (err) {
            settle({ ok: false, code: null, error: err.message });
            return;
          }
          child.on('spawn', () => { if (handlers.onStarted) handlers.onStarted(); });
          child.on('error', (err) => settle({ ok: false, code: null, error: err.message }));
          child.on('exit', (code) => settle({ ok: code === 0, code, error: null }));
          armGuard();
          try { child.unref(); } catch (_) {}
        };

        const terminal = detectLinuxTerminal();
        if (!terminal) { runDirect(); return; }

        let child;
        try {
          child = spawn(terminal.cmd, terminal.args(wrapperPath), { cwd: path.dirname(absPath), stdio: 'ignore', detached: true });
        } catch (err) {
          console.warn('[FastCmd] 终端启动失败, 回退直接执行:', err.message);
          runDirect();
          return;
        }
        child.on('spawn', () => {
          if (handlers.onStarted) handlers.onStarted();
          startExitPolling();
        });
        // spawn 失败 (node 保证 spawn/error 二选一, 此时不会重复启动脚本)
        child.on('error', (err) => {
          console.warn('[FastCmd] 终端启动失败, 回退直接执行:', err.message);
          runDirect();
        });
        // 终端已退出: 再等一小段确认退出码文件; 没有则视为终端没跑起脚本 → 回退直接执行
        child.on('exit', () => {
          setTimeout(() => {
            if (settled) return;
            if (fs.existsSync(exitFile)) readExitFile();
            else {
              console.warn('[FastCmd] 终端已退出但无退出码, 回退直接执行');
              runDirect();
            }
          }, 1500);
        });
        try { child.unref(); } catch (_) {}
      });
    };

    /**
     * 真实执行脚本 (绝对路径) — 按系统状态分发 (决策42)
     * win32 = 可见控制台 + cmd wrapper; linux = 可见终端 + sh wrapper; 其余系统不支持
     * @param {string} absPath 脚本绝对路径
     * @param {{onStarted?: Function}} [handlers] spawn 成功即回调 (不等脚本结束)
     * @returns {Promise<{ok:boolean, code:number|null, error:string|null, running?:boolean}>}
     */
    const executeScript = (absPath, handlers = {}) => {
      if (FastCmdPlatform.platform === 'win32') return executeScriptWindows(absPath, handlers);
      if (FastCmdPlatform.platform === 'linux') return executeScriptLinux(absPath, handlers);
      return Promise.resolve({ ok: false, code: null, error: `unsupported platform: ${FastCmdPlatform.platform}` });
    };
