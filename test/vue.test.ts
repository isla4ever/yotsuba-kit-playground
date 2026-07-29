// 组件级消费测试:从 registry 安装的 @iyotsuba/schedule-vue 真实挂载
import type { Course } from '@iyotsuba/schedule-vue'
import { YsSchedule, YsToday } from '@iyotsuba/schedule-vue'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

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

  it('keeps inactive overlap cards below the active course during both week transitions', async () => {
    vi.useFakeTimers()
    const overlapping: Course[] = [
      { id: 'odd', name: '体育（单周）', weekday: 4, startSection: 1, endSection: 2, startWeek: 1, endWeek: 16, parity: 'odd' },
      { id: 'even', name: '线性代数（双周）', weekday: 4, startSection: 1, endSection: 2, startWeek: 2, endWeek: 16, parity: 'even' },
    ]
    const wrapper = mount(YsSchedule, {
      props: { courses: overlapping, week: 1, reduceMotion: false, transition: 'wave' },
    })

    const assertLayers = () => {
      for (const layer of ['.ys-schedule__layer--leaving', '.ys-schedule__layer--current']) {
        const slots = wrapper.findAll(`${layer} .ys-schedule__card-slot`)
        const active = slots.find(slot => slot.attributes('data-course-active') === 'true')
        const inactive = slots.find(slot => slot.attributes('data-course-active') === 'false')
        expect(active?.attributes('style')).toContain('z-index: 2')
        expect(inactive?.attributes('style')).toContain('z-index: 0')
        expect(inactive?.attributes('style')).toContain('opacity: 0')
        expect(inactive?.attributes('style')).toContain('visibility: hidden')
      }
    }

    try {
      await wrapper.setProps({ week: 2 })
      await nextTick()
      assertLayers()
      vi.advanceTimersByTime(600)
      await nextTick()

      await wrapper.setProps({ week: 1 })
      await nextTick()
      assertLayers()
      vi.advanceTimersByTime(600)
      await nextTick()
    }
    finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })
})
