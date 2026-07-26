// 消费方视角的依赖测试:所有导入都来自 npm registry 安装的真实产物,
// 与 monorepo 源码零关联——库发布出问题(产物缺失/类型丢失/API 断裂)这里最先红。
import type { Course } from '@iyotsuba/schedule-core'
import {
  buildWeekModel,
  builtinTransitions,
  computeReminders,
  createShareCode,
  exportICS,
  isCourseActive,
  parseShareCode,
  resolveTransition,
  STANDARD_COURSE_TIMES,
} from '@iyotsuba/schedule-core'
import { describe, expect, it } from 'vitest'

const termStart = new Date(2026, 2, 2)
const courses: Course[] = [
  { id: 'math', name: '高等数学', location: '教1-201', weekday: 1, startSection: 1, endSection: 2, startWeek: 1, endWeek: 20 },
  { id: 'pe', name: '体育', weekday: 4, startSection: 1, endSection: 2, startWeek: 1, endWeek: 16, parity: 'odd' },
]

describe('registry package: @iyotsuba/schedule-core', () => {
  it('term engine works from the published artifact', () => {
    expect(isCourseActive(courses[1]!, 2)).toBe(false)
    const model = buildWeekModel(courses, 1, { termStart })
    expect(model.courses).toHaveLength(2)
  })

  it('ships wave transition and resolves names', () => {
    expect(Object.keys(builtinTransitions)).toContain('wave')
    expect(resolveTransition('wave').mode).toBe('per-cell')
    expect(resolveTransition(undefined).name).toBe('wave')
  })

  it('exports ICS and round-trips share codes', () => {
    const ics = exportICS(courses, { termStart, courseTimes: STANDARD_COURSE_TIMES, totalWeeks: 2 })
    expect(ics).toContain('BEGIN:VEVENT')
    const code = createShareCode(courses)
    expect(parseShareCode(code)?.[0]?.name).toBe('高等数学')
  })

  it('computes lead-time reminders', () => {
    const reminders = computeReminders(courses, {
      termStart,
      courseTimes: STANDARD_COURSE_TIMES,
      totalWeeks: 1,
      leadMinutes: 15,
    })
    expect(reminders.length).toBeGreaterThan(0)
    expect(reminders[0]!.at.getMinutes()).toBe(45)
  })
})
