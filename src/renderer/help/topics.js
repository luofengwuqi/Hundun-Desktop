// 帮助内容注册表 —— 新增一篇教程只需在这里加一条，不用碰任何组件。
//
// 字段约定：
//   title / intro / link.label / steps[].text / notes[]  都是 { zh, en }
//   steps[].art    = HELP_ART 里的线稿 key（可选）
//   steps[].image  = 静态图片路径，如 '/help/gitee-step1.png'（可选，优先于 art）
//   link.url       = 外链，交给主进程 openExternal（已限 https）
//
// 复用方式：任意组件里
//   const { openHelp } = useHelp()
//   openHelp('gitee-token')

export const HELP_TOPICS = {
  'gitee-token': {
    title: {
      zh: '怎么找到 Gitee 访问令牌',
      en: 'How to find your Gitee access token'
    },
    intro: {
      zh: '私有仓库需要一枚「私人令牌」，应用只用它调用 Gitee 接口建库与推送。令牌优先用系统密钥环加密存在本机，不会写进同步仓库，也不会出现在 git 地址里。',
      en: 'A private repository needs a personal access token. The app only uses it to call the Gitee API. The token is encrypted with your system keyring on this machine, never written into the synced repository or the git URL.'
    },
    link: {
      label: {
        zh: '在浏览器打开 Gitee 令牌设置',
        en: 'Open Gitee token settings in browser'
      },
      url: 'https://gitee.com/profile/personal_access_tokens'
    },
    steps: [
      {
        art: 'avatar-menu',
        text: {
          zh: '先在浏览器登录 Gitee，点右上角的头像，在展开的菜单里选「设置」。',
          en: 'Sign in to Gitee, click your avatar in the top-right corner, then pick Settings from the menu.'
        }
      },
      {
        art: 'side-menu',
        text: {
          zh: '在设置页左侧找到「私人令牌」，进入后点「生成新令牌」。也可以直接用下面的按钮跳到这一页。',
          en: 'In Settings, find Personal access tokens in the left sidebar, open it and click Generate new token. The button below takes you straight there.'
        }
      },
      {
        art: 'token-form',
        text: {
          zh: '随便填个描述（例如 hundun-desktop），权限只勾 projects 就够，然后提交。不需要把所有权限都给它。',
          en: 'Give it any description (for example hundun-desktop), tick only the projects scope, then submit. Full access is not needed.'
        }
      },
      {
        art: 'token-copy',
        text: {
          zh: '令牌只会完整显示这一次，立刻复制，回到本页粘进令牌输入框并保存。关掉页面后就再也看不到，只能重新生成一枚。',
          en: 'The token is shown in full only once. Copy it immediately, then paste it into the token field on this page and save. Once you leave the page it cannot be revealed again - you would have to generate a new one.'
        }
      }
    ],
    notes: [
      {
        zh: '用的是 GitHub？在 Settings → Developer settings → Personal access tokens 生成，勾 repo，用户名填 x-access-token。',
        en: 'Using GitHub instead? Generate it under Settings → Developer settings → Personal access tokens, tick repo, and use x-access-token as the username.'
      },
      {
        zh: '留空再点保存会清除已存的令牌；令牌输入框永远是密码框，不会回显明文。',
        en: 'Saving with an empty field clears the stored token. The field is always masked and never shows the token in plain text.'
      },
      {
        zh: '如果系统没有可用的密钥环，界面会标出「明文保存」，此时令牌以 0600 权限落在本机。',
        en: 'If no system keyring is available, the UI marks the token as stored in plain text; the file is still written with 0600 permissions.'
      }
    ]
  }
}

export const getHelpTopic = (id) => HELP_TOPICS[id] || null
