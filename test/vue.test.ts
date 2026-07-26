// 组件级消费测试:从 registry 安装的 @iyotsuba/schedule-vue 真实挂载
import type { Course } from '@iyotsuba/schedule-vue'
import { YsSchedule, YsToday } from '@iyotsuba/schedule-vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

const termStart = new Date(2026, 6, 20)
const courses: Course[] = [
  { id: 'math', name: '高等数学', weekday: 1, startSection: 1, endSection: 2, startWeek: 1, endWeek: 20, materials: ['教材'] },
]

describe('registry package: @iyotsuba/schedule-vue', () => {
  it('mounts YsSchedule with builtin panels wired', () => {
    const wrapper = mount(YsSchedule, {
      props: { courses, week: 1, termStart, reduceMotion: true },
    })
    expect(wrapper.text()).toContain('高等数学')
    expect(wrapper.text()).toContain('第 1 周')
    wrapper.unmount()
  })

  it('mounts YsToday and aggregates materials', () => {
    const wrapper = mount(YsToday, {
      props: { courses, termStart, now: new Date(2026, 6, 20, 7, 30) },
    })
    expect(wrapper.text()).toContain('记得带')
    expect(wrapper.text()).toContain('教材')
    wrapper.unmount()
  })

  it('emits controlled editing events (data stays host-owned)', async () => {
    const wrapper = mount(YsSchedule, {
      props: { courses, week: 1, termStart, reduceMotion: true, editable: true },
      attachTo: document.body,
    })
    const cell = wrapper.find('[data-ys-cell][data-weekday="2"][data-section="3"]')
    await cell.trigger('pointerdown')
    await cell.trigger('pointerup')
    expect(wrapper.emitted('cellSelect')?.[0]).toEqual([2, 3, 3])
    wrapper.unmount()
  })
})
