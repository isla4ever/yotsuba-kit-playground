// React 绑定展示:@iyotsuba/schedule-react(桥接自定义元素,类型化 props/事件)
import type { Course } from '@iyotsuba/schedule-react'
import { YsSchedule, YsToday } from '@iyotsuba/schedule-react'
import { useMemo, useState } from 'react'

const courses: Course[] = [
  { id: 'math', name: '高等数学', location: '教1-201', weekday: 1, startSection: 1, endSection: 2, startWeek: 1, endWeek: 20 },
  { id: 'en', name: '大学英语', location: '外语楼302', weekday: 2, startSection: 3, endSection: 4, startWeek: 1, endWeek: 20 },
  { id: 'pe', name: '体育（单周）', location: '东操场', weekday: 4, startSection: 1, endSection: 2, startWeek: 1, endWeek: 16, parity: 'odd' },
  { id: 'la', name: '线性代数（双周）', location: '教1-305', weekday: 4, startSection: 1, endSection: 2, startWeek: 2, endWeek: 16, parity: 'even' },
  { id: 'phy', name: '大学物理', location: '理科楼210', weekday: 5, startSection: 3, endSection: 4, startWeek: 1, endWeek: 16 },
]

export function App() {
  const [week, setWeek] = useState(1)
  const [view, setView] = useState<'schedule' | 'today'>('schedule')
  const termStart = useMemo(() => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() || 7) - 1))
    return monday
  }, [])

  return (
    <div style={{ maxWidth: 430, height: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <header style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #e3e8ee', fontSize: 13 }}>
        <strong>React Showcase</strong>
        <span style={{ fontSize: 10, color: '#8a94a3' }}>@iyotsuba/schedule-react</span>
        <span style={{ flex: 1 }} />
        <button onClick={() => setView('schedule')}>课表</button>
        <button onClick={() => setView('today')}>今日</button>
        <button onClick={() => setWeek(w => Math.max(1, w - 1))}>←</button>
        <span>第 {week} 周</span>
        <button onClick={() => setWeek(w => Math.min(20, w + 1))}>→</button>
      </header>
      <main style={{ flex: 1, minHeight: 0 }}>
        {view === 'schedule'
          ? (
              <YsSchedule
                courses={courses}
                week={week}
                termStart={termStart}
                onUpdateWeek={setWeek}
                onCourseTap={course => console.warn('course tap:', course.name)}
                style={{ height: '100%', display: 'block' }}
              />
            )
          : (
              <YsToday
                courses={courses}
                termStart={termStart}
                style={{ display: 'block', height: '100%', overflowY: 'auto' }}
              />
            )}
      </main>
    </div>
  )
}
