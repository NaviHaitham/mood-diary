import { describe, expect, it } from 'vitest';
import { blankDraft, entryDate, hasDraftContent, localDateTime, parseDraft } from './draft';
import { filterEntries, makeDemo, recommendationReason, activities } from './model';

describe('草稿与补记', () => {
  const now = new Date(2026, 9, 27, 15, 30);
  it('尚未选择情绪的文字草稿也能恢复，且不改变正文空格', () => {
    const draft = { ...blankDraft(), text: '  还没写完的想法  ', tags: ['面试'] };
    expect(parseDraft(JSON.parse(JSON.stringify(draft)))).toEqual(draft);
    expect(hasDraftContent(draft)).toBe(true);
    expect(hasDraftContent(blankDraft())).toBe(false);
  });
  it('损坏的草稿无法伪装成有效记录', () => {
    expect(() => parseDraft({ ...blankDraft(), moods: ['unknown'] })).toThrow();
    expect(() => parseDraft({ ...blankDraft(), intensity: 99 })).toThrow();
  });
  it('补记采用本地时间并拒绝未来日期和无效日历日期', () => {
    expect(localDateTime(now)).toBe('2026-10-27T15:30');
    expect(entryDate('2026-10-26T21:00', now)).toBe(new Date(2026, 9, 26, 21, 0).toISOString());
    expect(entryDate('', now)).toBe(now.toISOString());
    expect(() => entryDate('2026-10-28T12:00', now)).toThrow('不能晚于');
    expect(() => entryDate('2026-02-30T12:00', now)).toThrow('有效');
  });
  it('从标签统计跳转后，时间与精确标签同时生效', () => {
    const entries = makeDemo(now).entries;
    const filter = { mood: 'all', query: '', days: 7, tag: '工作' };
    expect(filterEntries(entries, filter, now)).toHaveLength(2);
    expect(filterEntries(entries, { ...filter, days: 3 }, now)).toHaveLength(0);
    expect(
      filterEntries([{ ...entries[0], tags: [], text: '工作有些忙' }], filter, now),
    ).toHaveLength(0);
  });
  it('推荐理由根据真实反馈和情绪线索生成', () => {
    const entry = { ...makeDemo(now).entries[0], moods: ['anxious' as const] };
    expect(recommendationReason(activities[0], [entry], [])).toContain('焦虑');
    expect(
      recommendationReason(
        activities[0],
        [entry],
        [{ id: '1', date: now.toISOString(), activityId: 'breathe', feedback: 'better' }],
      ),
    ).toContain('曾在');
    expect(recommendationReason(activities[0], [], [])).not.toContain('焦虑');
  });
});
