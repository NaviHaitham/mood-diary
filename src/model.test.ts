import { describe, expect, it } from 'vitest';
import { dayKey, inDays, makeDemo, parseBackup, recommendations, tagCounts, trend } from './model';
import { loadData, saveData } from './storage';
import 'fake-indexeddb/auto';

describe('日记统计与备份', () => {
  const now = new Date(2026, 9, 27, 15, 0);
  const data = makeDemo(now);
  it('按本地自然日统计，缺失日期留空，不把空白当成低强度', () => {
    const points = trend(data.entries, 7, now);
    expect(points).toHaveLength(7);
    expect(points[6].value).toBeNull();
    expect(points[0].date).toBe(dayKey(data.entries[0].date));
    expect(points[0].value).toBe(4);
    expect(inDays(data.entries, 1, now)).toHaveLength(0);
  });
  it('同一条日记里的重复事件标签只统计一次', () => {
    expect(tagCounts([{ ...data.entries[0], tags: ['工作', '工作'] }])).toEqual([['工作', 1]]);
  });
  it('校验备份，拒绝越界强度、未知情绪和重复编号', () => {
    expect(parseBackup({ version: 1, ...data })).toEqual(data);
    expect(() => parseBackup({ version: 1, ...data, entries: [{ ...data.entries[0], intensity: 6 }] })).toThrow();
    expect(() => parseBackup({ version: 1, ...data, entries: [{ ...data.entries[0], moods: ['unknown'] }] })).toThrow();
    expect(() => parseBackup({ version: 1, ...data, entries: [data.entries[0], data.entries[0]] })).toThrow();
  });
  it('不舒服的反馈会降低对应活动排序', () => {
    const ranked = recommendations([], [{ id: 'test', date: now.toISOString(), activityId: 'breathe', feedback: 'worse' }]);
    expect(ranked.at(-1)?.id).toBe('breathe');
  });
  it('IndexedDB 写入后可重新读取，清空后不残留个人记录', async () => {
    expect(await loadData()).toEqual({ entries: [], sessions: [] });
    await saveData(data);
    expect(await loadData()).toEqual(data);
    await saveData({ entries: [], sessions: [] });
    expect(await loadData()).toEqual({ entries: [], sessions: [] });
  });
  it('写入前校验失败，不覆盖已有的有效记录', async () => {
    await saveData(data);
    await expect(saveData({ ...data, entries: [{ ...data.entries[0], intensity: 99 }] })).rejects.toThrow();
    expect(await loadData()).toEqual(data);
    await saveData({ entries: [], sessions: [] });
  });
});
