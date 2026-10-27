import { useState } from 'react';
import { parseBackup, type MoodId } from './model';

export type Draft = {
  moods: MoodId[];
  intensity: number;
  tags: string[];
  text: string;
  recordedAt: string;
};
export const DRAFT_KEY = 'xinqing-entry-draft-v1';
export const blankDraft = (): Draft => ({
  moods: [],
  intensity: 3,
  tags: [],
  text: '',
  recordedAt: '',
});
export const hasDraftContent = (d: Draft) =>
  !!(d.moods.length || d.tags.length || d.text || d.recordedAt || d.intensity !== 3);

export function localDateTime(date = new Date()): string {
  const part = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}

export function entryDate(value: string, now = new Date()): string {
  if (!value) return now.toISOString();
  const date = new Date(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    localDateTime(date) !== value
  )
    throw new Error('请选择有效的记录时间。');
  if (date.getTime() > now.getTime())
    throw new Error('记录时间不能晚于现在，可以选择过去的时间补记。');
  return date.toISOString();
}

export function parseDraft(input: unknown): Draft {
  if (!input || typeof input !== 'object') throw new Error('草稿格式错误');
  const d = input as Record<string, unknown>;
  if (!Array.isArray(d.moods) || typeof d.recordedAt !== 'string' || d.recordedAt.length > 16)
    throw new Error('草稿字段错误');
  if (d.recordedAt) {
    // Validate the calendar date without rejecting a draft restored after a clock change.
    entryDate(d.recordedAt, new Date('9999-12-31T23:59:59Z'));
  }
  const e = parseBackup({
    version: 1,
    sessions: [],
    entries: [
      {
        ...d,
        id: 'draft',
        date: '2026-01-01T00:00:00Z',
        moods: d.moods.length ? d.moods : ['calm'],
      },
    ],
  }).entries[0];
  return {
    moods: d.moods.length ? e.moods : [],
    intensity: e.intensity,
    tags: e.tags,
    text: e.text,
    recordedAt: d.recordedAt,
  };
}

export function useDraft() {
  const [initial] = useState(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      return { value: raw ? parseDraft(JSON.parse(raw)) : blankDraft(), warning: '' };
    } catch {
      return {
        value: blankDraft(),
        warning: '草稿恢复不可用；当前内容暂存在页面中，建议及时保存日记。',
      };
    }
  });
  const [value, setValue] = useState(initial.value);
  const [warning, setWarning] = useState(initial.warning);
  const update = (next: Draft) => {
    setValue(next);
    try {
      if (hasDraftContent(next)) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(DRAFT_KEY);
      setWarning('');
    } catch {
      setWarning('当前草稿仅在页面中临时保留；请及时保存日记，避免刷新后丢失。');
    }
  };
  return {
    value,
    update,
    clear: () => update(blankDraft()),
    warning,
    hasContent: hasDraftContent(value),
  };
}

export type DraftController = ReturnType<typeof useDraft>;
