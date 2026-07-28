<script setup lang="ts">
import type {
  BuiltinTransitionName,
  CardEffect,
  Course,
  DayPlanMap,
  DetailAction,
  DetailField,
  DetailHero,
  DetailLayout,
  PaletteName,
  ScheduleDensity,
  SheetPlacement,
  TodayWidgetConfig,
  WeatherSnapshot,
} from '@iyotsuba/schedule-vue'
import {
  computeReminders,
  createShareCode,
  exportICS,
  isCourseActive,
  parseShareCode,
  STANDARD_COURSE_TIMES,
} from '@iyotsuba/schedule-core'
import { createOpenMeteoProvider } from '@iyotsuba/schedule-core/weather/open-meteo'
import { defaultScheduleGuideSteps, YsSchedule, YsSheet, YsToday } from '@iyotsuba/schedule-vue'
import {
  CalendarCheck2,
  CalendarDays,
  CalendarSync,
  Check,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Grid2X2,
  Image,
  List,
  LocateFixed,
  Moon,
  PanelTop,
  Pencil,
  RotateCcw,
  Settings2,
  Share2,
  Sparkles,
  Sun,
  Upload,
} from '@lucide/vue'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

type ViewName = 'schedule' | 'today'
type ScheduleLayout = 'grid' | 'list'
type ThemeName = 'light' | 'dark'
type TopBarPreset = 'compact' | 'standard' | 'expanded' | 'none'
type CourseCardStyle = CardEffect | 'weather'

interface PlaygroundConfig {
  theme: ThemeName
  scheduleLayout: ScheduleLayout
  topBar: TopBarPreset
  weekdayBar: boolean
  visibleDays: 5 | 6 | 7
  density: ScheduleDensity
  palette: PaletteName
  transition: BuiltinTransitionName
  courseCardStyle: CourseCardStyle
  weatherScene: boolean
  detailHero: DetailHero
  detailLayout: DetailLayout
  detailActions: boolean
  sheetPlacement: SheetPlacement
  sheetGlass: boolean
  showHeader: boolean
  showWeather: boolean
  showHeaderActions: boolean
  showDockLabels: boolean
}

const STORAGE = 'ys-playground'
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const DETAIL_FIELDS: DetailField[] = ['time', 'weeks', 'location', 'teacher', 'weather', 'note', 'materials', 'tasks']

const DEFAULT_CONFIG: PlaygroundConfig = {
  theme: 'light',
  scheduleLayout: 'grid',
  topBar: 'standard',
  weekdayBar: true,
  visibleDays: 7,
  density: 'normal',
  palette: 'classic',
  transition: 'wave',
  courseCardStyle: 'weather',
  weatherScene: true,
  detailHero: 'weather',
  detailLayout: 'standard',
  detailActions: true,
  sheetPlacement: 'right',
  sheetGlass: true,
  showHeader: true,
  showWeather: true,
  showHeaderActions: true,
  showDockLabels: true,
}

const seed: Course[] = [
  {
    id: 'math', name: '高等数学', teacher: '陈老师', location: '教1-201', weekday: 1, startSection: 1, endSection: 2, startWeek: 1, endWeek: 20,
    materials: [{ name: '计算器', kind: 'device' }],
    books: [{ id: 'math-book', title: '高等数学（第八版）', author: '同济大学数学科学学院', required: true }],
    tasks: [{ id: 'math-task', title: '完成第三章课后题', dueAt: '2026-08-02T21:00:00+08:00', priority: 'high' }],
    note: '课前完成本周习题',
  },
  { id: 'ds', name: '数据结构', teacher: '周老师', location: '教2-105', weekday: 1, startSection: 5, endSection: 6, startWeek: 1, endWeek: 20 },
  { id: 'en', name: '大学英语', teacher: 'Lily', location: '外语楼302', weekday: 2, startSection: 3, endSection: 4, startWeek: 1, endWeek: 20 },
  {
    id: 'prog', name: '程序设计', teacher: '吴老师', location: '机房A', weekday: 3, startSection: 5, endSection: 6, startWeek: 1, endWeek: 20,
    materials: [{ name: '电脑', kind: 'device' }, { name: 'Type-C 转接头', kind: 'equipment' }],
    tasks: [{ id: 'prog-task', title: '提交课程管理小程序', done: false }],
  },
  { id: 'pe', name: '体育（单周）', location: '东操场', weekday: 4, startSection: 1, endSection: 2, startWeek: 1, endWeek: 16, parity: 'odd', materials: ['运动鞋'] },
  { id: 'la', name: '线性代数（双周）', teacher: '彭老师', location: '教1-305', weekday: 4, startSection: 1, endSection: 2, startWeek: 2, endWeek: 16, parity: 'even' },
  { id: 'phy', name: '大学物理', teacher: '林老师', location: '理科楼210', weekday: 5, startSection: 3, endSection: 4, startWeek: 1, endWeek: 16 },
  { id: 'chem', name: '化学实验', teacher: '孙老师', location: '实验楼404', weekday: 5, startSection: 7, endSection: 9, startWeek: 1, endWeek: 8, materials: ['实验服', '护目镜'] },
]

const DEFAULT_TODAY_WIDGETS: TodayWidgetConfig[] = [
  { id: 'next-course', size: '2x1' },
  { id: 'weather', size: '1x1' },
  { id: 'today-timeline', size: '2x1' },
  { id: 'readiness', size: '2x1' },
  { id: 'course-tasks', size: '2x1' },
  { id: 'plans', size: '2x1' },
  { id: 'study-load', size: '1x2' },
  { id: 'week-glance', size: '2x2' },
]

const STUDY_LOAD = [
  { day: '一', minutes: 72 },
  { day: '二', minutes: 96 },
  { day: '三', minutes: 54 },
  { day: '四', minutes: 118 },
  { day: '五', minutes: 84 },
  { day: '六', minutes: 42 },
  { day: '日', minutes: 66 },
]
const STUDY_LOAD_MAX = Math.max(...STUDY_LOAD.map(item => item.minutes))

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
const todayWidgets = ref<TodayWidgetConfig[]>(load('today-widgets', DEFAULT_TODAY_WIDGETS))
const config = reactive<PlaygroundConfig>({ ...DEFAULT_CONFIG, ...load<Partial<PlaygroundConfig>>('config', {}) })
const week = ref(1)
const view = ref<ViewName>('schedule')
const editable = ref(false)
const settingsOpen = ref(false)
const toast = ref('')
const scheduleRef = ref<InstanceType<typeof YsSchedule> | null>(null)

const termStart = (() => {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() || 7) - 1))
  return monday
})()
const demoNow = (() => {
  const mondayMorning = new Date(termStart)
  mondayMorning.setHours(7, 35, 0, 0)
  return mondayMorning
})()

watch(config, value => save('config', value), { deep: true })
watch(todayWidgets, value => save('today-widgets', value), { deep: true })

function notify(message: string) {
  toast.value = message
  window.setTimeout(() => {
    if (toast.value === message) {
      toast.value = ''
    }
  }, 2200)
}

function onCourseAdd(course: Course) {
  courses.value = [...courses.value, course]
  save('courses', courses.value)
  notify(`已添加「${course.name}」`)
}

function onCourseUpdate(course: Course, previousId: string) {
  courses.value = courses.value.map(item => item.id === previousId ? course : item)
  save('courses', courses.value)
  notify('课程修改已保存')
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
  background.value = url ? { image: url, opacity: 0.34 } : null
  save('bg', background.value)
}

const weather = ref<WeatherSnapshot | null>(null)
const weatherState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const weatherLocation = ref('成都')

function locate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('geolocation unavailable'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 9000,
      maximumAge: 5 * 60 * 1000,
    })
  })
}

async function refreshWeather(useCurrentLocation = false) {
  if (weatherState.value === 'loading') {
    return
  }
  weatherState.value = 'loading'
  let latitude = 30.57
  let longitude = 104.06
  let locationLabel = '成都'

  if (useCurrentLocation) {
    notify('正在获取当前位置天气')
    try {
      const position = await locate()
      latitude = position.coords.latitude
      longitude = position.coords.longitude
      locationLabel = '当前位置'
    }
    catch {
      weatherState.value = weather.value ? 'ready' : 'error'
      notify('未能获取位置，请检查浏览器定位权限')
      return
    }
  }

  try {
    const provider = createOpenMeteoProvider({ latitude, longitude })
    weather.value = await provider.getSnapshot()
    weatherLocation.value = locationLabel
    weatherState.value = 'ready'
    if (useCurrentLocation) {
      notify('当前位置天气已更新')
    }
  }
  catch {
    weatherState.value = 'error'
    notify('天气服务暂时不可用')
  }
}

onMounted(() => refreshWeather(false))

const weatherKind = computed(() => weather.value?.current?.kind ?? 'neutral')
const weatherTemperature = computed(() => {
  const value = weather.value?.current?.temperatureC
  return value == null ? '--' : `${Math.round(value)}°`
})
const selectedCardEffect = computed<CardEffect>(() =>
  config.courseCardStyle === 'weather' ? 'none' : config.courseCardStyle,
)
const selectedWeatherCard = computed(() => ({
  enabled: true,
  glyph: true,
  background: config.courseCardStyle === 'weather',
  label: true,
  intensity: 0.72,
}))
const rowHeight = computed(() => config.density === 'minimal' ? 48 : config.density === 'rich' ? 64 : 56)
const detailActions = computed<DetailAction[]>(() => {
  if (!config.detailActions) {
    return []
  }
  return editable.value ? ['share', 'edit', 'remove'] : ['share']
})
const sheetConfig = computed(() => ({
  placement: config.sheetPlacement,
  placements: {
    weekPicker: 'bottom' as const,
    courseDetail: 'right' as const,
    courseForm: 'center' as const,
    dayPlanner: 'right' as const,
    background: 'center' as const,
  },
  glass: config.sheetGlass,
  contained: true,
  adjustable: true,
}))
const appVars = computed<Record<string, string>>(() => config.theme === 'dark'
  ? {
      '--ys-text-1': '#eef1f5', '--ys-text-2': '#b8c0cc', '--ys-text-3': '#7c8697',
      '--ys-surface-1': '#1d2128', '--ys-surface-2': '#242a33', '--ys-surface-3': '#2c333e',
      '--ys-border': '#333a45', '--ys-accent': '#6c9aec', '--ys-accent-soft': '#22314d',
      '--ys-success': '#35b795', '--ys-danger': '#e06a67',
    }
  : {
      '--ys-text-1': '#1c232d', '--ys-text-2': '#45505e', '--ys-text-3': '#8a94a3',
      '--ys-surface-1': '#ffffff', '--ys-surface-2': '#eef1f5', '--ys-surface-3': '#e3e8ee',
      '--ys-border': '#dde2e9', '--ys-accent': '#3d76dd', '--ys-accent-soft': '#e4edfc',
      '--ys-success': '#0f8f72', '--ys-danger': '#d1403f',
    })

const agendaDays = computed(() => WEEKDAYS.slice(0, config.visibleDays).map((label, index) => ({
  weekday: index + 1,
  label,
  courses: courses.value
    .filter(course => course.weekday === index + 1)
    .sort((a, b) => a.startSection - b.startSection),
})))

const nextReminder = computed(() => computeReminders(courses.value, {
  termStart,
  courseTimes: STANDARD_COURSE_TIMES,
  totalWeeks: 20,
  leadMinutes: 15,
  from: new Date(),
})[0] ?? null)

function downloadICS(label = '已导出日历文件') {
  const ics = exportICS(courses.value, { termStart, courseTimes: STANDARD_COURSE_TIMES, totalWeeks: 20 })
  const blob = new Blob([ics], { type: 'text/calendar' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'Yotsuba-课程表.ics'
  link.click()
  URL.revokeObjectURL(link.href)
  notify(label)
}

async function copyText(text: string, success: string) {
  try {
    await navigator.clipboard.writeText(text)
    notify(success)
  }
  catch {
    notify('当前浏览器未允许写入剪贴板')
  }
}

function copyShareCode() {
  return copyText(createShareCode(courses.value), '课表分享码已复制')
}

function importShareCode() {
  const code = window.prompt('粘贴课表分享码（YSK1:…）')
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

function shareCourse(course: Course) {
  const text = `${course.name} · ${WEEKDAYS[course.weekday - 1]} 第${course.startSection}-${course.endSection}节${course.location ? ` · ${course.location}` : ''}`
  return copyText(text, '课程信息已复制')
}

function selectView(next: ViewName) {
  settingsOpen.value = false
  view.value = next
}

async function openAgendaCourse(courseId: string) {
  config.scheduleLayout = 'grid'
  await nextTick()
  scheduleRef.value?.openCourse(courseId)
}

function resetConfig() {
  Object.assign(config, DEFAULT_CONFIG)
  todayWidgets.value = DEFAULT_TODAY_WIDGETS.map(widget => ({ ...widget }))
  notify('演示配置已恢复默认')
}

const topBarLabels: Record<TopBarPreset, string> = {
  compact: '紧凑',
  standard: '标准',
  expanded: '展开',
  none: '隐藏',
}

function cycleTopBar() {
  const presets: TopBarPreset[] = ['compact', 'standard', 'expanded']
  const current = config.topBar === 'none' ? 0 : presets.indexOf(config.topBar)
  config.topBar = presets[(current + 1) % presets.length]!
}
</script>

<template>
  <div class="app" :class="`is-${config.theme}`" :style="appVars">
    <header v-if="config.showHeader" class="app-header">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true" />
        <span class="brand__copy">
          <strong>Yotsuba 课表</strong>
          <small>第 {{ week }} 周 · 2026 秋季学期</small>
        </span>
      </div>

      <button
        v-if="config.showWeather"
        type="button"
        class="weather-button"
        :class="{ 'is-loading': weatherState === 'loading' }"
        :aria-label="weatherState === 'loading' ? '正在获取天气' : '使用当前位置更新天气'"
        :title="weatherState === 'loading' ? '正在获取天气' : '使用当前位置更新天气'"
        @click="refreshWeather(true)"
      >
        <LocateFixed v-if="weatherState === 'loading'" :size="17" :stroke-width="1.8" aria-hidden="true" />
        <Sun v-else-if="weatherKind === 'clear'" :size="17" :stroke-width="1.8" aria-hidden="true" />
        <CloudSun v-else-if="weatherKind === 'cloudy'" :size="17" :stroke-width="1.8" aria-hidden="true" />
        <CloudFog v-else-if="weatherKind === 'fog'" :size="17" :stroke-width="1.8" aria-hidden="true" />
        <CloudRain v-else-if="weatherKind === 'drizzle' || weatherKind === 'rain' || weatherKind === 'heavy-rain'" :size="17" :stroke-width="1.8" aria-hidden="true" />
        <CloudLightning v-else-if="weatherKind === 'storm'" :size="17" :stroke-width="1.8" aria-hidden="true" />
        <Cloud v-else :size="17" :stroke-width="1.8" aria-hidden="true" />
        <span>{{ weatherTemperature }}</span>
        <small>{{ weatherLocation }}</small>
      </button>

      <div v-if="config.showHeaderActions" class="header-actions" aria-label="课表操作">
        <button type="button" aria-label="同步到日历" title="同步到日历" @click="downloadICS('日历文件已生成')">
          <CalendarSync :size="17" aria-hidden="true" />
        </button>
        <button type="button" aria-label="分享课表" title="分享课表" @click="copyShareCode">
          <Share2 :size="17" aria-hidden="true" />
        </button>
      </div>
    </header>

    <main class="stage">
      <section v-if="view === 'schedule'" class="module-toolbar" aria-label="课表视图工具栏">
        <div class="module-toolbar__title">
          <strong>课程表</strong>
          <small v-if="nextReminder">{{ nextReminder.course.name }} · {{ String(nextReminder.at.getHours()).padStart(2, '0') }}:{{ String(nextReminder.at.getMinutes()).padStart(2, '0') }}</small>
        </div>

        <div class="segmented" aria-label="课表布局">
          <button type="button" :aria-pressed="config.scheduleLayout === 'grid'" :class="{ on: config.scheduleLayout === 'grid' }" title="周视图" @click="config.scheduleLayout = 'grid'">
            <Grid2X2 :size="15" aria-hidden="true" /><span>周视图</span>
          </button>
          <button type="button" :aria-pressed="config.scheduleLayout === 'list'" :class="{ on: config.scheduleLayout === 'list' }" title="列表" @click="config.scheduleLayout = 'list'">
            <List :size="15" aria-hidden="true" /><span>列表</span>
          </button>
        </div>

        <label class="compact-select">
          <span class="sr-only">换周动画</span>
          <select v-model="config.transition" aria-label="换周动画">
            <option value="wave">波浪</option>
            <option value="slide">滑动</option>
            <option value="fade">淡入</option>
            <option value="cube">立方体</option>
            <option value="drop">落下</option>
            <option value="zoom">缩放</option>
          </select>
        </label>

        <button
          type="button"
          class="icon-button topbar-switch"
          :aria-label="`切换课表顶部栏样式，当前${topBarLabels[config.topBar]}`"
          :title="`顶部栏：${topBarLabels[config.topBar]}`"
          @click="cycleTopBar"
        >
          <PanelTop :size="17" aria-hidden="true" />
          <span>{{ topBarLabels[config.topBar] }}</span>
        </button>

        <button type="button" class="icon-button" :class="{ on: editable }" :aria-label="editable ? '完成编辑' : '编辑课表'" :title="editable ? '完成编辑' : '编辑课表'" @click="editable = !editable">
          <Check v-if="editable" :size="17" aria-hidden="true" />
          <Pencil v-else :size="17" aria-hidden="true" />
        </button>
      </section>

      <div class="stage__content">
        <YsSchedule
          v-if="view === 'schedule' && config.scheduleLayout === 'grid'"
          ref="scheduleRef"
          v-model:week="week"
          class="stage__schedule"
          :courses="courses"
          :term-start="termStart"
          :weather="weather"
          :day-plans="dayPlans"
          :background="background"
          :editable="editable"
          :theme="config.theme"
          :top-bar="config.topBar"
          :weekday-bar="config.weekdayBar"
          :visible-days="config.visibleDays"
          :row-height="rowHeight"
          :density="config.density"
          :palette="config.palette"
          :transition="config.transition"
          :card-effect="selectedCardEffect"
          :weather-card="selectedWeatherCard"
          :weather-scene="config.weatherScene"
          :sheets="sheetConfig"
          :detail="{ hero: config.detailHero, layout: config.detailLayout, fields: DETAIL_FIELDS, actions: detailActions, adjustable: true }"
          :guide="{ mode: 'walkthrough', steps: defaultScheduleGuideSteps, storageKey: 'ys-playground-guide' }"
          @course-add="onCourseAdd"
          @course-update="onCourseUpdate"
          @course-remove="onCourseRemove"
          @course-share="shareCourse"
          @detail-layout-change="config.detailLayout = $event"
          @plan-add="onPlanAdd"
          @plan-toggle="onPlanToggle"
          @plan-remove="onPlanRemove"
          @background-change="onBackgroundChange"
        />

        <section v-else-if="view === 'schedule'" class="agenda" aria-label="课程列表">
          <div v-for="day in agendaDays" :key="day.weekday" class="agenda__day">
            <div class="agenda__day-head">
              <strong>{{ day.label }}</strong>
              <span>{{ day.courses.length }} 门</span>
            </div>
            <div v-if="day.courses.length" class="agenda__rows">
              <button v-for="course in day.courses" :key="course.id" type="button" class="agenda__row" @click="openAgendaCourse(course.id)">
                <span class="agenda__time">{{ course.startSection }}-{{ course.endSection }}节</span>
                <span class="agenda__course">
                  <strong>{{ course.name }}</strong>
                  <small>{{ [course.teacher, course.location].filter(Boolean).join(' · ') || '待补充课程信息' }}</small>
                </span>
                <span class="agenda__status" :class="{ active: isCourseActive(course, week) }">{{ isCourseActive(course, week) ? '本周' : '非本周' }}</span>
              </button>
            </div>
            <p v-else class="agenda__empty">无课程</p>
          </div>
        </section>

        <YsToday
          v-else
          v-model:widgets="todayWidgets"
          class="stage__today"
          :courses="courses"
          :term-start="termStart"
          :now="demoNow"
          :weather="weather"
          :day-plans="dayPlans"
          :theme="config.theme"
          :weather-scene="config.weatherScene"
          empty-text="暂无信息"
          arrangeable
        >
          <template #widget-study-load="{ layout }">
            <div class="study-load" :class="`is-${layout.columns}x${layout.rows}`">
              <div class="study-load__head">
                <div>
                  <span>学习投入</span>
                  <strong>8.9 小时</strong>
                </div>
                <small>较上周 +12%</small>
              </div>

              <div v-if="layout.columns === 1 && layout.rows === 1" class="study-load__compact">
                <b>126</b><span>今日分钟</span>
              </div>

              <ul v-else-if="layout.columns === 1" class="study-load__sessions">
                <li><span>高等数学</span><b>48 分钟</b></li>
                <li><span>数据结构</span><b>42 分钟</b></li>
                <li><span>英语听力</span><b>36 分钟</b></li>
              </ul>

              <div v-else class="study-load__chart" role="img" aria-label="本周每日学习时长柱状图">
                <div v-for="item in STUDY_LOAD" :key="item.day">
                  <b v-if="layout.rows === 2">{{ item.minutes }}</b>
                  <i><span :style="{ height: `${item.minutes / STUDY_LOAD_MAX * 100}%` }" /></i>
                  <small>{{ item.day }}</small>
                </div>
              </div>

              <div v-if="layout.columns === 2 && layout.rows === 2" class="study-load__summary">
                <span><b>4</b> 次深度专注</span>
                <span><b>78%</b> 目标完成</span>
              </div>
            </div>
          </template>
        </YsToday>
      </div>
    </main>

    <nav class="dock" aria-label="主导航">
      <button type="button" :class="{ on: view === 'schedule' && !settingsOpen }" :aria-current="view === 'schedule' && !settingsOpen ? 'page' : undefined" @click="selectView('schedule')">
        <CalendarDays :size="20" aria-hidden="true" />
        <span v-if="config.showDockLabels">课表</span>
      </button>
      <button type="button" :class="{ on: view === 'today' && !settingsOpen }" :aria-current="view === 'today' && !settingsOpen ? 'page' : undefined" @click="selectView('today')">
        <CalendarCheck2 :size="20" aria-hidden="true" />
        <span v-if="config.showDockLabels">今日</span>
      </button>
      <button type="button" :class="{ on: settingsOpen }" :aria-expanded="settingsOpen" @click="settingsOpen = true">
        <Settings2 :size="20" aria-hidden="true" />
        <span v-if="config.showDockLabels">设置</span>
      </button>
    </nav>

    <YsSheet
      :open="settingsOpen"
      kind="settings"
      title="演示设置"
      :vars="appVars"
      :placement="config.sheetPlacement"
      :glass="config.sheetGlass"
      contained
      adjustable
      @close="settingsOpen = false"
    >
      <div class="settings-panel">
        <div class="settings-panel__lead">
          <strong>组件配置</strong>
          <button type="button" @click="resetConfig"><RotateCcw :size="14" aria-hidden="true" />恢复默认</button>
        </div>

        <section class="settings-group">
          <h3>外观</h3>
          <div class="setting-row">
            <span>主题</span>
            <div class="segmented segmented--settings">
              <button type="button" :class="{ on: config.theme === 'light' }" @click="config.theme = 'light'"><Sun :size="14" aria-hidden="true" />浅色</button>
              <button type="button" :class="{ on: config.theme === 'dark' }" @click="config.theme = 'dark'"><Moon :size="14" aria-hidden="true" />深色</button>
            </div>
          </div>
          <label class="setting-row"><span>课程配色</span><select v-model="config.palette"><option value="classic">经典</option><option value="macaron">马卡龙</option><option value="morandi">莫兰迪</option><option value="cyber">赛博</option><option value="forest">森系</option><option value="sunset">落日</option></select></label>
        </section>

        <section class="settings-group">
          <h3>课表模块</h3>
          <label class="setting-row"><span>信息密度</span><select v-model="config.density"><option value="minimal">精简</option><option value="normal">标准</option><option value="rich">丰富</option></select></label>
          <label class="setting-row"><span>课程卡表现</span><select v-model="config.courseCardStyle"><option value="weather">实时天气</option><option value="none">无</option><option value="shimmer">微光</option><option value="glow">辉光</option><option value="aurora">极光</option><option value="breathe">呼吸</option></select></label>
          <label class="setting-row"><span>显示天数</span><select v-model.number="config.visibleDays"><option :value="5">5 天</option><option :value="6">6 天</option><option :value="7">7 天</option></select></label>
          <label class="setting-row"><span>星期栏</span><input v-model="config.weekdayBar" type="checkbox" role="switch"></label>
          <label class="setting-row"><span>天气场景</span><input v-model="config.weatherScene" type="checkbox" role="switch"></label>
        </section>

        <section class="settings-group">
          <h3>课程详情</h3>
          <label class="setting-row"><span>详情样式</span><select v-model="config.detailHero"><option value="color">课程色</option><option value="weather">天气融合</option><option value="plain">极简</option></select></label>
          <label class="setting-row"><span>默认布局</span><select v-model="config.detailLayout"><option value="compact">精简</option><option value="standard">适中</option><option value="full">全面</option></select></label>
          <label class="setting-row"><span>详情动作</span><input v-model="config.detailActions" type="checkbox" role="switch"></label>
        </section>

        <section class="settings-group">
          <h3>弹层</h3>
          <label class="setting-row"><span>默认位置</span><select v-model="config.sheetPlacement"><option value="bottom">底部</option><option value="center">居中</option><option value="right">右侧</option></select></label>
          <label class="setting-row"><span>毛玻璃</span><input v-model="config.sheetGlass" type="checkbox" role="switch"></label>
        </section>

        <section class="settings-group">
          <h3>应用外壳</h3>
          <label class="setting-row"><span>Header</span><input v-model="config.showHeader" type="checkbox" role="switch"></label>
          <label class="setting-row"><span>天气入口</span><input v-model="config.showWeather" type="checkbox" role="switch"></label>
          <label class="setting-row"><span>Header 操作</span><input v-model="config.showHeaderActions" type="checkbox" role="switch"></label>
          <label class="setting-row"><span>Dock 文字</span><input v-model="config.showDockLabels" type="checkbox" role="switch"></label>
        </section>

        <section class="settings-group settings-group--actions">
          <h3>数据与引导</h3>
          <div class="settings-actions">
            <button type="button" @click="scheduleRef?.openBackgroundPicker(); settingsOpen = false"><Image :size="16" aria-hidden="true" />背景</button>
            <button type="button" @click="scheduleRef?.startGuide(); settingsOpen = false"><Sparkles :size="16" aria-hidden="true" />引导</button>
            <button type="button" @click="importShareCode"><Upload :size="16" aria-hidden="true" />导入</button>
          </div>
        </section>
      </div>
    </YsSheet>

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.app {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1180px;
  height: 100dvh;
  min-width: 0;
  margin: 0 auto;
  overflow: hidden;
  color: var(--ys-text-1);
  background: var(--ys-surface-1);
  box-shadow: 0 0 48px rgb(25 35 52 / 10%);
  isolation: isolate;
}

.app-header {
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10px;
  align-items: center;
  min-height: 58px;
  padding: 8px 14px;
  background: color-mix(in srgb, var(--ys-surface-1) 94%, transparent);
  border-bottom: 1px solid var(--ys-border);
}

.brand { display: flex; gap: 9px; align-items: center; min-width: 0; }
.brand__mark { width: 9px; height: 28px; background: var(--ys-accent); border-radius: 3px; }
.brand__copy { display: flex; flex-direction: column; min-width: 0; }
.brand__copy strong { overflow: hidden; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
.brand__copy small { overflow: hidden; margin-top: 1px; font-size: 10px; color: var(--ys-text-3); text-overflow: ellipsis; white-space: nowrap; }

.weather-button,
.header-actions button,
.icon-button {
  display: inline-grid;
  place-items: center;
  min-width: 36px;
  height: 36px;
  padding: 0;
  font: inherit;
  color: var(--ys-text-2);
  cursor: pointer;
  background: var(--ys-surface-2);
  border: 1px solid var(--ys-border);
  border-radius: 7px;
}

.topbar-switch {
  display: inline-flex;
  gap: 5px;
  width: auto;
  padding: 0 8px;
  font-size: 10px;
  font-weight: 650;
}

.weather-button {
  display: flex;
  gap: 5px;
  width: auto;
  padding: 0 9px;
  font-size: 12px;
  font-weight: 700;
}
.weather-button small { font-size: 9px; font-weight: 500; color: var(--ys-text-3); }
.weather-button.is-loading svg { animation: weather-pulse 900ms ease-in-out infinite alternate; }

.header-actions { display: flex; gap: 5px; }
.header-actions button:hover,
.icon-button:hover,
.weather-button:hover { color: var(--ys-accent); border-color: color-mix(in srgb, var(--ys-accent) 35%, var(--ys-border)); }
.header-actions button:focus-visible,
.icon-button:focus-visible,
.weather-button:focus-visible,
.dock button:focus-visible,
.segmented button:focus-visible { outline: 3px solid color-mix(in srgb, var(--ys-accent) 35%, transparent); outline-offset: 2px; }

.stage { display: flex; flex: 1; flex-direction: column; min-width: 0; min-height: 0; }
.stage__content { position: relative; flex: 1; min-width: 0; min-height: 0; padding-bottom: 78px; overflow: hidden; }
.stage__schedule,
.stage__today { width: 100%; max-width: 100%; height: 100%; min-width: 0; }
.stage__today { overflow-y: auto; scrollbar-width: none; }
.stage__today::-webkit-scrollbar { display: none; }

.study-load { display: flex; flex-direction: column; height: 100%; min-width: 0; }
.study-load__head { display: flex; gap: 8px; align-items: flex-start; justify-content: space-between; }
.study-load__head > div { display: flex; flex-direction: column; min-width: 0; }
.study-load__head span { font-size: 10px; font-weight: 700; color: var(--ys-text-3); }
.study-load__head strong { margin-top: 2px; font-size: 18px; }
.study-load__head small { flex: 0 0 auto; font-size: 9px; color: var(--ys-success); }
.study-load__compact { display: flex; gap: 6px; align-items: baseline; margin-top: auto; }
.study-load__compact b { font-size: 26px; }
.study-load__compact span { font-size: 9px; color: var(--ys-text-3); }
.study-load__sessions { display: flex; flex: 1; flex-direction: column; justify-content: space-around; padding: 10px 0 0; margin: 0; list-style: none; }
.study-load__sessions li { display: flex; gap: 6px; justify-content: space-between; font-size: 10px; color: var(--ys-text-2); }
.study-load__sessions li b { font-weight: 650; color: var(--ys-text-1); }
.study-load__chart { display: flex; flex: 1; gap: 7px; align-items: flex-end; min-height: 34px; margin-top: 10px; }
.study-load__chart > div { display: grid; flex: 1; grid-template-rows: auto minmax(0, 1fr) auto; gap: 3px; height: 100%; min-width: 0; text-align: center; }
.study-load__chart b { font-size: 8px; color: var(--ys-text-3); }
.study-load__chart i { display: flex; align-items: flex-end; min-height: 0; overflow: hidden; background: var(--ys-accent-soft); border-radius: 3px 3px 1px 1px; }
.study-load__chart i span { display: block; width: 100%; min-height: 3px; background: var(--ys-accent); border-radius: 3px 3px 1px 1px; transition: height 180ms ease; }
.study-load__chart small { font-size: 8px; color: var(--ys-text-3); }
.study-load__summary { display: flex; gap: 18px; margin-top: 10px; padding-top: 9px; font-size: 9px; color: var(--ys-text-3); border-top: 1px solid var(--ys-border); }
.study-load__summary b { margin-right: 3px; font-size: 11px; color: var(--ys-text-1); }
.study-load.is-2x1 .study-load__head strong { font-size: 15px; }
.study-load.is-2x1 .study-load__chart { margin-top: 5px; }

.module-toolbar {
  z-index: 12;
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  min-height: 48px;
  padding: 6px 12px;
  background: var(--ys-surface-1);
  border-bottom: 1px solid var(--ys-border);
}
.module-toolbar__title { display: flex; flex: 1; flex-direction: column; min-width: 70px; }
.module-toolbar__title strong { font-size: 13px; }
.module-toolbar__title small { overflow: hidden; margin-top: 1px; font-size: 9px; color: var(--ys-text-3); text-overflow: ellipsis; white-space: nowrap; }

.segmented { display: flex; flex: 0 0 auto; gap: 2px; padding: 2px; background: var(--ys-surface-2); border-radius: 7px; }
.segmented button {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 8px;
  font: inherit;
  font-size: 11px;
  font-weight: 650;
  color: var(--ys-text-3);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 5px;
}
.segmented button.on { color: var(--ys-accent); background: var(--ys-surface-1); box-shadow: 0 1px 3px rgb(25 35 52 / 10%); }
.segmented--settings button { min-width: 62px; }

.compact-select select,
.setting-row select {
  height: 34px;
  padding: 0 24px 0 9px;
  font: inherit;
  font-size: 11px;
  color: var(--ys-text-2);
  cursor: pointer;
  background: var(--ys-surface-2);
  border: 1px solid var(--ys-border);
  border-radius: 7px;
}
.compact-select select { width: 78px; }
.icon-button.on { color: #fff; background: var(--ys-accent); border-color: var(--ys-accent); }

.agenda {
  height: 100%;
  padding: 12px 14px 20px;
  overflow-y: auto;
  scrollbar-width: none;
  background: color-mix(in srgb, var(--ys-surface-2) 55%, var(--ys-surface-1));
}
.agenda::-webkit-scrollbar { display: none; }
.agenda__day { max-width: 760px; margin: 0 auto 18px; }
.agenda__day-head { display: flex; align-items: center; justify-content: space-between; padding: 0 2px 7px; border-bottom: 1px solid var(--ys-border); }
.agenda__day-head strong { font-size: 13px; }
.agenda__day-head span { font-size: 10px; color: var(--ys-text-3); }
.agenda__rows { display: flex; flex-direction: column; }
.agenda__row {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  width: 100%;
  min-height: 58px;
  padding: 7px 2px;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--ys-border);
}
.agenda__time { font-size: 11px; color: var(--ys-text-3); font-variant-numeric: tabular-nums; }
.agenda__course { display: flex; flex-direction: column; min-width: 0; }
.agenda__course strong { font-size: 13px; }
.agenda__course small { overflow: hidden; margin-top: 3px; font-size: 10px; color: var(--ys-text-3); text-overflow: ellipsis; white-space: nowrap; }
.agenda__status { padding: 3px 6px; font-size: 9px; color: var(--ys-text-3); background: var(--ys-surface-2); border-radius: 5px; }
.agenda__status.active { color: var(--ys-success); background: color-mix(in srgb, var(--ys-success) 10%, var(--ys-surface-1)); }
.agenda__empty { padding: 14px 2px 0; margin: 0; font-size: 11px; color: var(--ys-text-3); }

.dock {
  position: absolute;
  bottom: max(12px, env(safe-area-inset-bottom, 0px));
  left: 50%;
  z-index: 80;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: min(348px, calc(100% - 24px));
  height: 58px;
  padding: 5px;
  background: color-mix(in srgb, var(--ys-surface-1) 88%, transparent);
  backdrop-filter: blur(16px) saturate(1.25);
  border: 1px solid color-mix(in srgb, var(--ys-border) 75%, transparent);
  border-radius: 12px;
  box-shadow: 0 10px 28px rgb(25 35 52 / 18%);
  transform: translateX(-50%);
}
.dock button {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0;
  font: inherit;
  font-size: 9px;
  font-weight: 650;
  color: var(--ys-text-3);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
}
.dock button.on { color: var(--ys-accent); background: var(--ys-accent-soft); }

.settings-panel { padding: 0 0 8px; }
.settings-panel__lead { display: flex; align-items: center; justify-content: space-between; min-height: 42px; border-bottom: 1px solid var(--ys-border); }
.settings-panel__lead strong { font-size: 13px; }
.settings-panel__lead button,
.settings-actions button {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  min-height: 34px;
  padding: 0 9px;
  font: inherit;
  font-size: 11px;
  font-weight: 650;
  color: var(--ys-text-2);
  cursor: pointer;
  background: var(--ys-surface-2);
  border: 1px solid var(--ys-border);
  border-radius: 7px;
}
.settings-group { padding: 13px 0 8px; border-bottom: 1px solid var(--ys-border); }
.settings-group h3 { margin: 0 0 6px; font-size: 10px; font-weight: 750; color: var(--ys-text-3); text-transform: uppercase; }
.setting-row { display: flex; gap: 12px; align-items: center; justify-content: space-between; min-height: 43px; font-size: 12px; }
.setting-row > span { color: var(--ys-text-2); }
.setting-row select { min-width: 118px; }
.setting-row input[role="switch"] {
  position: relative;
  width: 38px;
  height: 22px;
  margin: 0;
  cursor: pointer;
  appearance: none;
  background: var(--ys-surface-3);
  border: 1px solid var(--ys-border);
  border-radius: 11px;
  transition: background-color 160ms ease;
}
.setting-row input[role="switch"]::after {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  content: '';
  background: var(--ys-surface-1);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgb(25 35 52 / 25%);
  transition: transform 160ms ease;
}
.setting-row input[role="switch"]:checked { background: var(--ys-accent); border-color: var(--ys-accent); }
.setting-row input[role="switch"]:checked::after { transform: translateX(16px); }
.settings-group--actions { border-bottom: 0; }
.settings-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.settings-actions button { justify-content: center; min-width: 0; }

.toast {
  position: absolute;
  bottom: max(82px, calc(70px + env(safe-area-inset-bottom, 0px)));
  left: 50%;
  z-index: 1200;
  max-width: calc(100% - 32px);
  padding: 8px 13px;
  overflow: hidden;
  font-size: 12px;
  color: #fff;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: rgb(28 35 45 / 94%);
  border-radius: 7px;
  transform: translateX(-50%);
}
.toast-enter-active,
.toast-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.toast-enter-from,
.toast-leave-to { opacity: 0; transform: translate(-50%, 5px); }

:deep(.stage__schedule .ys-schedule__body) { padding-bottom: 4px; }
:deep(.ys-sheet__overlay.is-contained) { z-index: 200; }

@keyframes weather-pulse { to { opacity: 0.35; } }

@media (max-width: 540px) {
  .app { box-shadow: none; }
  .app-header { grid-template-columns: minmax(0, 1fr) auto auto; gap: 6px; min-height: 54px; padding-inline: 10px; }
  .brand__mark { height: 24px; }
  .brand__copy strong { font-size: 13px; }
  .brand__copy small { font-size: 8px; }
  .weather-button { padding-inline: 7px; }
  .weather-button small { display: none; }
  .header-actions { gap: 3px; }
  .header-actions button { min-width: 33px; height: 34px; }
  .module-toolbar { gap: 5px; padding-inline: 8px; }
  .module-toolbar__title { flex: 1 1 44px; min-width: 44px; }
  .module-toolbar__title small { display: none; }
  .segmented button { padding-inline: 6px; }
  .compact-select select { width: 66px; padding-left: 6px; font-size: 10px; }
  .topbar-switch { width: 34px; padding: 0; }
  .topbar-switch span { display: none; }
  .settings-actions { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 360px) {
  .brand__copy small,
  .module-toolbar__title { display: none; }
  .module-toolbar { justify-content: space-between; }
  .segmented button span { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after { scroll-behavior: auto !important; transition-duration: 1ms !important; animation-duration: 1ms !important; }
}
</style>
