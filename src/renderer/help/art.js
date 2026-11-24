// 帮助页内置的「示意图」—— 纯线稿，不冒充真实界面截图。
//
// 为什么不用截图：Gitee 界面会改版，AI 生成的假截图还会把按钮文字画错，
// 反而误导。线稿只表达「在哪一块、点哪里」，具体文字交给步骤说明，
// 天然跨语言、跨主题（颜色一律走 currentColor / CSS 变量）。
//
// 新增一张图：往 HELP_ART 里加一个 key 即可；topic 的 step.art 填这个 key。
// 若将来要放真实截图，直接给 step 加 image 字段（指向 /help/xxx.png），
// HelpView 会优先显示 image，没有才回落到这里的线稿。

const frame = (inner) =>
  `<svg viewBox="0 0 320 120" fill="none" stroke="currentColor" stroke-width="2" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`

// 顶栏 + 头像下拉：高亮头像和下拉里的「设置」那一行
const avatarMenu = frame(`
  <rect class="ha-box" x="8" y="8" width="304" height="26" rx="6" />
  <path class="ha-dim" d="M20 21h34M62 21h22" />
  <path class="ha-dim" d="M212 21h28M248 21h22" />
  <circle class="hl" cx="290" cy="21" r="9" />
  <circle class="hl-dash" cx="290" cy="21" r="15" />
  <rect class="ha-box" x="214" y="40" width="98" height="72" rx="6" />
  <path class="ha-dim" d="M226 55h52M226 89h52M226 101h38" />
  <rect class="hl-box" x="222" y="65" width="82" height="19" rx="4" />
  <path class="hl" d="M230 74h30" />
`)

// 设置页：左侧导航高亮「私人令牌」，主区高亮「生成新令牌」
const sideMenu = frame(`
  <rect class="ha-box" x="8" y="8" width="304" height="104" rx="6" />
  <path class="ha-dim" d="M96 8v104" />
  <path class="ha-dim" d="M20 28h56M20 44h48M20 92h56M20 104h44" />
  <rect class="hl-box" x="16" y="57" width="72" height="19" rx="4" />
  <path class="hl" d="M22 66h44" />
  <path class="ha-dim" d="M118 28h120M118 40h86" />
  <rect class="hl-box" x="118" y="70" width="140" height="26" rx="6" />
  <path class="hl" d="M134 83h18M143 74v18" />
  <path class="hl" d="M162 83h72" />
`)

// 生成表单：描述输入 + 权限勾选（projects 打勾）+ 提交
const tokenForm = frame(`
  <rect class="ha-box" x="8" y="8" width="304" height="104" rx="6" />
  <path class="ha-dim" d="M24 20h96" />
  <rect class="ha-box" x="24" y="28" width="272" height="18" rx="4" />
  <path class="ha-dim" d="M32 37h84" />
  <rect class="ha-box" x="24" y="54" width="12" height="12" rx="2" />
  <path class="ha-dim" d="M46 60h74" />
  <rect class="hl-box" x="24" y="72" width="12" height="12" rx="2" />
  <path class="hl" d="M27 78l3 3 5-7" />
  <path class="hl" d="M46 78h58" />
  <path class="ha-dim" d="M170 60h60M170 78h44" />
  <rect class="hl-box" x="246" y="94" width="50" height="14" rx="4" />
`)

// 复制令牌（只显示一次）→ 回到本应用的令牌栏粘贴
const tokenCopy = frame(`
  <rect class="ha-box" x="8" y="14" width="236" height="30" rx="5" />
  <path class="ha-dim" d="M22 29h8m6 0h8m6 0h8m6 0h8m6 0h8m6 0h8m6 0h8m6 0h8m6 0h8m6 0h8" />
  <rect class="hl-box" x="252" y="14" width="52" height="30" rx="5" />
  <rect class="hl" x="264" y="22" width="12" height="14" rx="2" />
  <path class="hl" d="M280 22h12v14h-12" />
  <circle class="hl-dash" cx="278" cy="29" r="21" />
  <path class="hl" d="M150 52v20m-6-6l6 6 6-6" />
  <rect class="hl-box" x="8" y="80" width="296" height="26" rx="5" />
  <path class="hl" d="M20 93h56" />
  <path class="ha-dim" d="M88 93h120" />
  <rect class="hl-box" x="244" y="84" width="52" height="18" rx="4" />
`)

export const HELP_ART = {
  'avatar-menu': avatarMenu,
  'side-menu': sideMenu,
  'token-form': tokenForm,
  'token-copy': tokenCopy
}

export const getHelpArt = (key) => HELP_ART[key] || ''
