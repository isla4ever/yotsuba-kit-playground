<script setup lang="ts">
// Vue 全功能展示:真实 App 形态——localStorage 持久化、天气 Provider、
// 编辑/日计划/背景/引导/导入导出全链路。所有依赖来自 npm registry。
import type { Course, DayPlanMap, WeatherSnapshot } from '@iyotsuba/schedule-vue'
import { computeReminders, createShareCode, exportICS, parseShareCode, STANDARD_COURSE_TIMES } from '@iyotsuba/schedule-core'
import { createOpenMeteoProvider } from '@iyotsuba/schedule-core/weather/open-meteo'
import { defaultScheduleGuideSteps, YsSchedule, YsToday } from '@iyotsuba/schedule-vue'
import { computed, onMounted, ref } from 'vue'

/* ---------- 持久化(真实 App 模式:宿主持有数据,组件只发事件) ---------- */
const STORAGE = 'ys-playground'

const seed: Course[] = [
  { id: 'math', name: '高等数学', teacher: '陈老师', location: '教1-201', weekday: 1, startSection: 1, endSection: 2, startWeek: 1, endWeek: 20, materials: ['教材', '计算器'] },
  { id: 'ds', name: '数据结构', location: '教2-105', weekday: 1, startSection: 5, endSection: 6, startWeek: 1, endWeek: 20 },
  { id: 'en', name: '大学英语', location: '外语楼302', weekday: 2, startSection: 3, endSection: 4, startWeek: 1, endWeek: 20 },
  { id: 'prog', name: '程序设计', location: '机房A', weekday: 3, startSection: 5, endSection: 6, startWeek: 1, endWeek: 20 },
  { id: 'pe', name: '体育（单周）', location: '东操场', weekday: 4, startSection: 1, endSection: 2, startWeek: 1, endWeek: 16, parity: 'odd', materials: ['运动鞋'] },
  { id: 'la', name: '线性代数（双周）', location: '教1-305', weekday: 4, startSection: 1, endSection: 2, startWeek: 2, endWeek: 16, parity: 'even' },
  { id: 'phy', name: '大学物理', location: '理科楼210', weekday: 5, startSection: 3, endSection: 4, startWeek: 1, endWeek: 16 },
  { id: 'chem', name: '化学实验', location: '实验楼404', weekday: 5, startSection: 7, endSection: 9, startWeek: 1, endWeek: 8, materials: ['实验服', '护目镜'] },
]

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${STORAGE}:${key}`)
    return raw ? JSON.parse(raw) as T : fallback
  }
  catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  localStorage.setItem(`${STORAGE}:${key}`, JSON.stringify(value))
}

const courses = ref<Course[]>(load('courses', seed))
const dayPlans = ref<DayPlanMap>(load('plans', {}))
const background = ref<{ image?: string, opacity?: number } | null>(load('bg', null))
const week = ref(1)
const view = ref<'schedule' | 'today'>('schedule')
const editable = ref(false)
const dark = ref(false)
const toast = ref('')
const scheduleRef = ref<InstanceType<typeof YsSchedule> | null>(null)

const termStart = (() => {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() || 7) - 1))
  return monday
})()

function notify(message: string) {
  toast.value = message
  setTimeout(() => toast.value = '', 2200)
}

/* ---------- 受控数据回写 ---------- */
function onCourseAdd(course: Course) {
  courses.value = [...courses.value, course]
  save('courses', courses.value)
  notify(`已添加「${course.name}」`)
}
function onCourseUpdate(course: Course, previousId: string) {
  courses.value = courses.value.map(item => item.id === previousId ? course : item)
  save('courses', courses.value)
  notify('已保存修改')
}
function onCourseRemove(course: { id: string, name: string }) {
  courses.value = courses.value.filter(item => item.id !== course.id)
  save('courses', courses.value)
  notify(`已删除「${course.name}」`)
}
function onPlanAdd(dateKey: string, text: string) {
  const list = dayPlans.value[dateKey] ?? []
  dayPlans.value = { ...dayPlans.value, [dateKey]: [...list, { id: `p${Date.now()}`, text, done: false }] }
  save('plans', dayPlans.value)
}
function onPlanToggle(dateKey: string, id: string) {
  dayPlans.value = {
    ...dayPlans.value,
    [dateKey]: (dayPlans.value[dateKey] ?? []).map(plan => plan.id === id ? { ...plan, done: !plan.done } : plan),
  }
  save('plans', dayPlans.value)
}
function onPlanRemove(dateKey: string, id: string) {
  dayPlans.value = { ...dayPlans.value, [dateKey]: (dayPlans.value[dateKey] ?? []).filter(plan => plan.id !== id) }
  save('plans', dayPlans.value)
}
function onBackgroundChange(url: string | null) {
  background.value = url ? { image: url, opacity: 0.35 } : null
  save('bg', background.value)
}

/* ---------- 天气:open-meteo 真实接入(免费无 key) ---------- */
const weather = ref<WeatherSnapshot | null>(null)
onMounted(async () => {
  try {
    const provider = createOpenMeteoProvider({ latitude: 30.57, longitude: 104.06 }) // 成都
    weather.value = await provider.getSnapshot()
  }
  catch {
    // 离线时静默降级
  }
})

/* ---------- 导出 / 分享 / 提醒 ---------- */
function downloadICS() {
  const ics = exportICS(courses.value, { termStart, courseTimes: STANDARD_COURSE_TIMES, totalWeeks: 20 })
  const blob = new Blob([ics], { type: 'text/calendar' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = '课程表.ics'
  link.click()
  URL.revokeObjectURL(link.href)
  notify('已导出 .ics,可导入系统日历')
}

async function copyShareCode() {
  await navigator.clipboard.writeText(createShareCode(courses.value))
  notify('分享码已复制')
}

function importShareCode() {
  const code = prompt('粘贴课表分享码(YSK1:…)')
  if (!code) {
    return
  }
  const parsed = parseShareCode(code.trim())
  if (!parsed) {
    notify('分享码无效')
    return
  }
  courses.value = parsed
  save('courses', courses.value)
  notify(`已导入 ${parsed.length} 门课程`)
}

const nextReminder = computed(() => {
  const list = computeReminders(courses.value, {
    termStart,
    courseTimes: STANDARD_COURSE_TIMES,
    totalWeeks: 20,
    leadMinutes: 15,
    from: new Date(),
  })
  return list[0] ?? null
})
</script>

<template>
  <div class="app" :class="{ dark }">
    <header class="bar">
      <strong>Yotsuba Kit Playground</strong>
      <span class="bar__meta">npm 真实依赖 · @iyotsuba/schedule-vue</span>
      <span class="bar__spacer" />
      <button :class="{ on: view === 'schedule' }" @click="view = 'schedule'">课表</button>
      <button :class="{ on: view === 'today' }" @click="view = 'today'">今日</button>
      <button @click="dark = !dark">{{ dark ? '☀️' : '🌙' }}</button>
    </header>

    <main class="stage">
      <YsSchedule
        v-if="view === 'schedule'"
        ref="scheduleRef"
        v-model:week="week"
        class="stage__schedule"
        :courses="courses"
        :term-start="termStart"
        :weather="weather"
        :day-plans="dayPlans"
        :background="background"
        :editable="editable"
        :theme="dark ? 'dark' : 'light'"
        transition="wave"
        :guide="{ mode: 'walkthrough', steps: defaultScheduleGuideSteps, storageKey: 'ys-playground-guide' }"
        @course-add="onCourseAdd"
        @course-update="onCourseUpdate"
        @course-remove="onCourseRemove"
        @plan-add="onPlanAdd"
        @plan-toggle="onPlanToggle"
        @plan-remove="onPlanRemove"
        @background-change="onBackgroundChange"
      />
      <YsToday
        v-else
        class="stage__today"
        :courses="courses"
        :term-start="termStart"
        :weather="weather"
        :day-plans="dayPlans"
        :theme="dark ? 'dark' : 'light'"
      />
    </main>

    <footer class="dock">
      <button :class="{ on: editable }" @click="editable = !editable">{{ editable ? '完成编辑' : '✏️ 编辑' }}</button>
      <button @click="scheduleRef?.openBackgroundPicker()">🖼 背景</button>
      <button @click="scheduleRef?.startGuide()">✨ 引导</button>
      <button @click="downloadICS">📆 .ics</button>
      <button @click="copyShareCode">🔗 分享码</button>
      <button @click="importShareCode">📥 导入</button>
    </footer>

    <p v-if="nextReminder" class="reminder">
      ⏰ 下一条提醒:{{ nextReminder.at.getMonth() + 1 }}/{{ nextReminder.at.getDate() }}
      {{ String(nextReminder.at.getHours()).padStart(2, '0') }}:{{ String(nextReminder.at.getMinutes()).padStart(2, '0') }}
      · {{ nextReminder.course.name }}
    </p>

    <Transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  max-width: 430px;
  height: 100%;
  min-width: 0;
  margin: 0 auto;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 0 40px rgb(0 0 0 / 8%);
}

.app.dark { background: #14171c; }

.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
  min-width: 0;
  padding: 8px 12px;
  font-size: 13px;
  border-bottom: 1px solid #e3e8ee;
}

.bar strong { white-space: nowrap; }

.app.dark .bar { color: #eef1f5; border-color: #333a45; }

.bar__meta {
  overflow: hidden;
  font-size: 10px;
  color: #8a94a3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar__spacer { flex: 1; }

.bar button,
.dock button {
  padding: 5px 10px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  background: #eef1f5;
  border: 0;
  border-radius: 7px;
}

.app.dark .bar button,
.app.dark .dock button { color: #eef1f5; background: #242a33; }

.bar button.on,
.dock button.on { color: #fff; background: #3d76dd; }

.stage { flex: 1; min-height: 0; }
.stage__schedule { height: 100%; }
.stage__today { height: 100%; overflow-y: auto; }

.dock {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  padding: 8px;
  border-top: 1px solid #e3e8ee;
}

.dock button { white-space: nowrap; }

.app.dark .dock { border-color: #333a45; }

.reminder {
  padding: 4px 12px 8px;
  margin: 0;
  font-size: 11px;
  color: #8a94a3;
  text-align: center;
}

.toast {
  position: fixed;
  bottom: 88px;
  left: 50%;
  padding: 8px 16px;
  font-size: 13px;
  color: #fff;
  background: rgb(28 35 45 / 92%);
  border-radius: 9px;
  transform: translateX(-50%);
}

.toast-enter-active,
.toast-leave-active { transition: opacity 200ms ease; }
.toast-enter-from,
.toast-leave-to { opacity: 0; }
</style>
