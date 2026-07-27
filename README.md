# Yotsuba Kit Web 演示与消费验证

面向中国大学课表场景的 Vue、React 和原生 Web 演示项目，同时负责验证 `@iyotsuba/schedule-*` 从 NPM 安装后的真实消费体验。

这里不是组件库源码仓库：组件能力来自 [yotsuba-kit](https://github.com/isla4ever/yotsuba-kit)，本仓库只通过公开 API 组装完整应用，用来发现类型、导出、事件、样式和打包边界问题。

## Yotsuba 项目关系

| 项目 | 定位 |
| --- | --- |
| **[yotsuba-kit](https://github.com/isla4ever/yotsuba-kit)** | Web 主体组件库、NPM 包和文档官网 |
| **[yotsuba-kit-playground](https://github.com/isla4ever/yotsuba-kit-playground)** | 当前仓库：Vue / React / 原生 Web 演示与依赖消费验证 |
| **[yotsuba-kit-flutter](https://github.com/isla4ever/yotsuba-kit-flutter)** | Flutter 组件包、完整应用和 Flutter 演示 |

文档官网：[isla4ever.github.io/yotsuba-kit](https://isla4ever.github.io/yotsuba-kit/)

## 演示内容

| 目录 | 内容 |
| --- | --- |
| `vue-app/` | Vue 全功能演示：课表 / 今日 / 设置、天气、教材、携带物、课程任务、详情弹层、编辑、日计划、背景、引导、ICS 和分享码 |
| `react-app/` | React 类型化绑定演示：受控周次、天气课程卡、详情、Today 任务和触摸排版 |
| `vanilla.html` | 原生 HTML 与 `<ys-schedule>` 自定义元素的零构建示例 |
| `test/` | core、ICS、分享码、提醒、Vue 挂载和编辑事件的消费方测试 |

Vue 演示的设置项直接绑定 `@iyotsuba/schedule-vue` Props，不是只修改演示应用外层样式。长期默认放在设置中，高频调整保留在对应模块：周 Header 切换档位，课程详情切换精简 / 适中 / 全面，弹层 Header 调整位置，Today 通过长按或 Header 入口编辑布局。

## 运行

```bash
pnpm install
pnpm test
pnpm dev:vue
pnpm dev:react
open vanilla.html
```

构建两个框架演示：

```bash
pnpm build
```

## 本地联调与发布验证

开发期的 Vue / React 应用通过 `link:` 连接相邻的 `yotsuba-kit` 工作树，便于在 NPM 发版前验证 current main API。

正式发布验收必须把依赖切换为明确的 registry 版本，并重新执行安装、测试和双端构建。只有消费的是 NPM 产物，而不是本地源码链接，才能证明包导出、声明文件和依赖关系真实可用。

每日 CI 会重新解析兼容范围内的最新发布版本，并拉取 `yotsuba-kit` 当前主分支构建
Vue / React 的源码联调依赖；随后统一运行消费方测试和双端构建，用于尽早发现已发布版本
或主分支 API 的破坏。

## 移动端交互边界

- 天气按钮只在用户主动点击后申请定位，再由宿主调用 Open-Meteo 或其他 Provider。
- 同一份天气快照驱动 Header、星期预报、课程卡、背景场景、详情和 Today。
- Today 面向触摸：整卡拖动、智能让位和四角缩放，不绑定桌面方向键。
- 导出、分享、系统日历、通知和持久化均由演示应用作为宿主接管。

## License

本仓库演示代码采用 [MIT](LICENSE)；组件库许可证见 [yotsuba-kit](https://github.com/isla4ever/yotsuba-kit)。
