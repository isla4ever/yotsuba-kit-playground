# Yotsuba Kit Playground

[@iyotsuba/schedule-*](https://github.com/isla4ever/yotsuba-kit) 组件库的**消费方测试与使用展示项目**。
所有依赖从 npm registry 真实安装(与 monorepo 源码零关联)——装的就是用户装到的东西,
发布产物出问题(缺文件/类型丢失/API 断裂)这里最先红。

| 目录 | 内容 |
| --- | --- |
| `vue-app/` | **Vue 全功能展示**:编辑模式、日计划、携带提醒、背景上传裁剪、手把手引导、open-meteo 真实天气、.ics 导出、分享码导入导出、提醒引擎、localStorage 持久化 |
| `react-app/` | React 绑定(`@iyotsuba/schedule-react`)课表 + 今日 |
| `vanilla.html` | 零构建:esm.sh CDN + `<ys-schedule>` 自定义元素,浏览器直接打开 |
| `test/` | 消费方依赖测试(vitest):registry 产物的引擎/ICS/分享码/提醒/组件挂载/编辑事件 |

## 运行

```bash
pnpm install
pnpm test        # 消费方依赖测试
pnpm dev:vue     # Vue 全功能展示
pnpm dev:react   # React 展示
open vanilla.html
```

CI 每日定时用 `^` 范围内的最新发布版重跑全部测试与构建(持续消费验证)。
