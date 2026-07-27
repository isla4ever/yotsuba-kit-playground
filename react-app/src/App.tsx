import type {
  BuiltinTransitionName,
  CardEffect,
  Course,
  DetailLayout,
  TodayWidgetConfig,
  WeatherSnapshot,
  YsScheduleElement,
  YsTodayElement,
} from '@iyotsuba/schedule-react'
import { YsSchedule, YsToday } from '@iyotsuba/schedule-react'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  LayoutDashboard,
  LocateFixed,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import './App.css'

type ViewName = 'schedule' | 'today'

const courses: Course[] = [
  {
    id: 'math', name: '高等数学', teacher: '陈老师', location: '教1-201', weekday: 1,
    startSection: 1, endSection: 2, startWeek: 1, endWeek: 20,
    books: [{ id: 'math-book', title: '高等数学（第八版）', author: '同济大学数学科学学院' }],
    materials: [{ name: '计算器', kind: 'device' }],
    tasks: [{ id: 'math-task', title: '完成第三章课后题', priority: 'high' }],
    note: '课前完成本周习题。',
  },
  {
    id: 'data', name: '数据结构', teacher: '周老师', location: '教2-105', weekday: 1,
    startSection: 5, endSection: 6, startWeek: 1, endWeek: 20,
    materials: [{ name: '电脑', kind: 'device' }],
    tasks: [{ id: 'data-task', title: '提交图遍历实验', done: false }],
  },
  {
    id: 'english', name: '大学英语', teacher: 'Lily', location: '外语楼302', weekday: 2,
    startSection: 3, endSection: 4, startWeek: 1, endWeek: 20,
    books: [{ title: 'Academic English', required: true }],
  },
  {
    id: 'programming', name: '程序设计', teacher: '吴老师', location: '机房A', weekday: 3,
    startSection: 5, endSection: 6, startWeek: 1, endWeek: 20,
    materials: [{ name: '电脑', kind: 'device' }, { name: 'Type-C 转接头', kind: 'equipment' }],
  },
  {
    id: 'pe', name: '体育（单周）', location: '东操场', weekday: 4,
    startSection: 1, endSection: 2, startWeek: 1, endWeek: 16, parity: 'odd',
    materials: ['运动鞋'],
  },
  {
    id: 'algebra', name: '线性代数（双周）', teacher: '彭老师', location: '教1-305', weekday: 4,
    startSection: 1, endSection: 2, startWeek: 2, endWeek: 16, parity: 'even',
  },
  {
    id: 'physics', name: '大学物理', teacher: '林老师', location: '理科楼210', weekday: 5,
    startSection: 3, endSection: 4, startWeek: 1, endWeek: 16,
  },
]

const initialWidgets: TodayWidgetConfig[] = [
  { id: 'next-course', size: '2x1' },
  { id: 'weather', size: '1x1' },
  { id: 'today-timeline', size: '2x1' },
  { id: 'readiness', size: '1x2' },
  { id: 'course-tasks', size: '2x1' },
  { id: 'plans', size: '2x1' },
  { id: 'week-glance', size: '2x2' },
]

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function App() {
  const [week, setWeek] = useState(1)
  const [view, setView] = useState<ViewName>('schedule')
  const [transition, setTransition] = useState<BuiltinTransitionName>('wave')
  const [cardEffect, setCardEffect] = useState<CardEffect>('shimmer')
  const [detailLayout, setDetailLayout] = useState<DetailLayout>('standard')
  const [weatherScene, setWeatherScene] = useState(true)
  const [widgets, setWidgets] = useState(initialWidgets)
  const [arranging, setArranging] = useState(false)
  const [toast, setToast] = useState('')
  const scheduleRef = useRef<YsScheduleElement>(null)
  const todayRef = useRef<YsTodayElement>(null)

  const termStart = useMemo(() => {
    const now = new Date()
    const monday = new Date(now)
    monday.setHours(0, 0, 0, 0)
    monday.setDate(now.getDate() - ((now.getDay() || 7) - 1))
    return monday
  }, [])
  const demoNow = useMemo(() => {
    const mondayMorning = new Date(termStart)
    mondayMorning.setHours(7, 35, 0, 0)
    return mondayMorning
  }, [termStart])

  const weather = useMemo<WeatherSnapshot>(() => {
    const kinds = ['clear', 'cloudy', 'rain', 'overcast', 'clear', 'drizzle', 'cloudy'] as const
    return {
      current: { kind: 'cloudy', temperatureC: 26, label: '多云' },
      daily: Array.from({ length: 21 }, (_, index) => {
        const date = new Date(termStart)
        date.setDate(date.getDate() + index)
        return {
          date: dateKey(date),
          kind: kinds[index % kinds.length]!,
          lowC: 20 + index % 3,
          highC: 27 + index % 4,
        }
      }),
      updatedAt: new Date(),
    }
  }, [termStart])

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(current => current === message ? '' : current), 1800)
  }

  function openView(next: ViewName) {
    setView(next)
    setArranging(false)
  }

  function toggleArrangement() {
    const next = !arranging
    setArranging(next)
    todayRef.current?.setArranging(next)
  }

  return (
    <div className="react-demo">
      <header className="demo-header">
        <div className="brand-block">
          <i aria-hidden="true" />
          <div>
            <strong>Yotsuba 课表</strong>
            <span>React 消费演示 · 第 {week} 周</span>
          </div>
        </div>
        <button className="weather-chip" type="button" title="当前位置天气" onClick={() => notify('演示天气已刷新')}>
          <CloudSun size={18} aria-hidden="true" />
          <b>26°</b>
          <span>多云</span>
          <LocateFixed size={14} aria-hidden="true" />
        </button>
      </header>

      <section className="control-strip" aria-label="演示设置">
        <div className="week-stepper">
          <button type="button" title="上一周" aria-label="上一周" disabled={week <= 1} onClick={() => setWeek(value => Math.max(1, value - 1))}>
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => scheduleRef.current?.openWeekPicker()}>第 {week} 周</button>
          <button type="button" title="下一周" aria-label="下一周" disabled={week >= 20} onClick={() => setWeek(value => Math.min(20, value + 1))}>
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
        <label>
          <span>换周</span>
          <select value={transition} onChange={event => setTransition(event.target.value as BuiltinTransitionName)}>
            <option value="wave">波浪</option>
            <option value="slide">滑动</option>
            <option value="fade">淡入</option>
            <option value="cube">立方体</option>
          </select>
        </label>
        <label>
          <span>卡片</span>
          <select value={cardEffect} onChange={event => setCardEffect(event.target.value as CardEffect)}>
            <option value="shimmer">流光</option>
            <option value="glow">微光</option>
            <option value="aurora">极光</option>
            <option value="breathe">呼吸</option>
            <option value="none">关闭</option>
          </select>
        </label>
        <label>
          <span>详情</span>
          <select value={detailLayout} onChange={event => setDetailLayout(event.target.value as DetailLayout)}>
            <option value="compact">精简</option>
            <option value="standard">适中</option>
            <option value="full">全面</option>
          </select>
        </label>
        <label className="switch-label">
          <span>天气背景</span>
          <input type="checkbox" checked={weatherScene} onChange={event => setWeatherScene(event.target.checked)} />
        </label>
        {view === 'today' && (
          <button className={arranging ? 'tool-button is-active' : 'tool-button'} type="button" onClick={toggleArrangement}>
            {arranging ? <Check size={16} aria-hidden="true" /> : <SlidersHorizontal size={16} aria-hidden="true" />}
            {arranging ? '完成' : '排版'}
          </button>
        )}
        {view === 'today' && arranging && (
          <button className="icon-button" type="button" title="恢复今日布局" aria-label="恢复今日布局" onClick={() => todayRef.current?.layoutReset()}>
            <RotateCcw size={16} aria-hidden="true" />
          </button>
        )}
      </section>

      <main className="demo-stage">
        {view === 'schedule' ? (
          <YsSchedule
            ref={scheduleRef}
            className="kit-surface"
            courses={courses}
            week={week}
            termStart={termStart}
            weather={weather}
            transition={transition}
            cardEffect={cardEffect}
            weatherCard={{ enabled: true, glyph: true, background: true, label: true, intensity: 0.72 }}
            weekdayWeather="full"
            weatherScene={weatherScene}
            detail={{
              hero: 'weather',
              layout: detailLayout,
              fields: ['time', 'weeks', 'location', 'teacher', 'weather', 'materials', 'tasks', 'note'],
              emptyText: '暂无信息',
              adjustable: true,
            }}
            sheets={{ placement: 'bottom', placements: { courseDetail: 'right' }, glass: true, adjustable: true, contained: true }}
            onUpdateWeek={setWeek}
            onCourseTap={course => notify(`已打开「${course.name}」`)}
            onDetailLayoutChange={setDetailLayout}
          />
        ) : (
          <YsToday
            ref={todayRef}
            className="kit-surface today-surface"
            courses={courses}
            termStart={termStart}
            now={demoNow}
            weather={weather}
            widgets={widgets}
            weatherScene={weatherScene}
            arrangeable
            emptyText="暂无信息"
            onWidgetsChange={setWidgets}
            onLayoutEditing={setArranging}
            onCourseTap={course => notify(`今日课程：${course.name}`)}
          />
        )}
      </main>

      <nav className="demo-dock" aria-label="主导航">
        <button type="button" className={view === 'schedule' ? 'is-active' : ''} onClick={() => openView('schedule')}>
          <CalendarDays size={20} aria-hidden="true" />
          <span>课表</span>
        </button>
        <button type="button" className={view === 'today' ? 'is-active' : ''} onClick={() => openView('today')}>
          <LayoutDashboard size={20} aria-hidden="true" />
          <span>今日</span>
        </button>
        <button type="button" onClick={() => notify('设置已在顶部工具栏展开')}>
          <Settings2 size={20} aria-hidden="true" />
          <span>设置</span>
        </button>
      </nav>

      {toast && <div className="demo-toast" role="status">{toast}</div>}
    </div>
  )
}
