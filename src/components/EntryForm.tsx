import { useId, useState, type CSSProperties } from 'react';
import { CalendarDays, Check, LockKeyhole, Pencil, Plus, X } from 'lucide-react';
import { moods, tags, type Entry, type MoodId } from '../model';
import { entryDate, localDateTime, type Draft, type DraftController } from '../draft';
import MoodFace from './MoodFace';

type Props = {
  initial?: Entry;
  draft?: DraftController;
  busy: boolean;
  loading?: boolean;
  onSave: (entry: Entry) => Promise<boolean>;
  compact?: boolean;
};

export default function EntryForm({
  initial,
  draft,
  busy,
  loading = false,
  onSave,
  compact = false,
}: Props) {
  const formId = useId();
  const [edit, setEdit] = useState<Draft>(() => ({
    moods: initial?.moods ?? [],
    intensity: initial?.intensity ?? 3,
    tags: initial?.tags ?? [],
    text: initial?.text ?? '',
    recordedAt: initial ? localDateTime(new Date(initial.date)) : '',
  }));
  const current = initial ? edit : draft!.value;
  const [error, setError] = useState('');
  const [customTag, setCustomTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [discard, setDiscard] = useState(false);
  const update = (patch: Partial<Draft>) => {
    const next = { ...current, ...patch };
    if (initial) setEdit(next);
    else draft!.update(next);
    setError('');
  };
  const toggleMood = (id: MoodId) =>
    update({
      moods: current.moods.includes(id)
        ? current.moods.filter((m) => m !== id)
        : [...current.moods, id],
    });
  const toggleTag = (tag: string) => {
    if (!current.tags.includes(tag) && current.tags.length >= 12) {
      setError('一条日记最多选择 12 个事件标签。');
      return;
    }
    update({
      tags: current.tags.includes(tag)
        ? current.tags.filter((t) => t !== tag)
        : [...current.tags, tag],
    });
  };
  const addTag = () => {
    const tag = customTag.trim().replace(/^#+/, '').trim();
    if (!tag) return;
    if (current.tags.length >= 12 && !current.tags.includes(tag)) {
      setError('一条日记最多选择 12 个事件标签。');
      return;
    }
    if (!current.tags.includes(tag)) update({ tags: [...current.tags, tag] });
    setCustomTag('');
    setAddingTag(false);
  };
  return (
    <form
      className={`entry-form ${compact ? 'compact' : ''}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!current.moods.length) {
          setError('先选一种情绪吧，也可以同时选择几种。');
          return;
        }
        try {
          // Read the native value as well: date pickers and browser autofill may
          // commit their final value just before the submit event.
          const submittedTime = String(new FormData(e.currentTarget).get('recordedAt') ?? '');
          const date =
            initial && submittedTime === localDateTime(new Date(initial.date))
              ? initial.date
              : entryDate(submittedTime);
          const saved = await onSave({
            id: initial?.id ?? crypto.randomUUID(),
            date,
            moods: current.moods,
            intensity: current.intensity,
            tags: current.tags,
            text: current.text.trim(),
          });
          if (saved && !initial) {
            draft!.clear();
            setError('');
            setDiscard(false);
          }
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      {!initial && draft!.hasContent && (
        <div className={`draft-status ${draft!.warning ? 'warning' : ''}`}>
          <span>{draft!.warning || '草稿已保留 · 切换页面或刷新后可继续'}</span>
          <button type="button" disabled={busy} onClick={() => setDiscard(true)}>
            清除草稿
          </button>
        </div>
      )}
      {!initial && discard && (
        <div className="draft-discard" role="alert">
          <p>只清除这份未提交草稿，已保存的日记不受影响。</p>
          <div>
            <button type="button" className="text-button" onClick={() => setDiscard(false)}>
              保留草稿
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                draft!.clear();
                setDiscard(false);
              }}
            >
              确认清除
            </button>
          </div>
        </div>
      )}
      <fieldset disabled={busy}>
        <legend className="field-label">
          此刻，你感觉怎么样？<span>可多选</span>
        </legend>
        <div className="mood-picker">
          {moods.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`mood-option ${current.moods.includes(m.id) ? 'selected' : ''}`}
              aria-pressed={current.moods.includes(m.id)}
              onClick={() => toggleMood(m.id)}
            >
              <MoodFace mood={m.id} />
              <span>{m.label}</span>
              {current.moods.includes(m.id) && <Check className="mood-check" size={12} />}
            </button>
          ))}
        </div>
        <div className="range-label">
          <label htmlFor={`${formId}-intensity`}>情绪的强度</label>
          <span>
            {['', '很轻微', '有一点', '适中', '比较强烈', '非常强烈'][current.intensity]} ·{' '}
            {current.intensity}/5
          </span>
        </div>
        <input
          id={`${formId}-intensity`}
          type="range"
          min="1"
          max="5"
          value={current.intensity}
          onChange={(e) => update({ intensity: Number(e.target.value) })}
          style={{ '--range': `${(current.intensity - 1) * 25}%` } as CSSProperties}
        />
        <div className="range-ends">
          <span>轻轻的</span>
          <span>很强烈</span>
        </div>
        <label className="field-label text-label" htmlFor={`${formId}-text`}>
          发生了什么小事？<span>选填</span>
        </label>
        <textarea
          id={`${formId}-text`}
          placeholder="可能是一场对话、一个念头，或今天的天气……"
          maxLength={3000}
          value={current.text}
          onChange={(e) => update({ text: e.target.value })}
          rows={compact ? 3 : 4}
        />
        <div className="entry-meta">
          <span>不必组织语言，想到什么就写什么。</span>
          <span>{current.text.length}/3000</span>
        </div>
        <div className="entry-tags">
          {[...new Set([...tags, ...current.tags])].map((tag) => (
            <button
              type="button"
              className={`tag ${current.tags.includes(tag) ? 'active' : ''}`}
              key={tag}
              aria-pressed={current.tags.includes(tag)}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
          <button
            type="button"
            className="tag add-tag"
            aria-expanded={addingTag}
            onClick={() => setAddingTag(!addingTag)}
          >
            <Plus size={11} />
            自定义
          </button>
        </div>
        {addingTag && (
          <div className="custom-tag-input">
            <input
              autoFocus
              aria-label="自定义事件标签"
              value={customTag}
              maxLength={30}
              placeholder="如：面试、通勤、阅读"
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <button
              type="button"
              className="button secondary"
              onClick={addTag}
              disabled={!customTag.trim()}
            >
              添加
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="取消添加标签"
              onClick={() => setAddingTag(false)}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <details className="record-options" open={current.recordedAt ? true : undefined}>
          <summary>
            <CalendarDays size={13} />
            {current.recordedAt ? '记录时间（补记）' : '补记过去的时刻'}
          </summary>
          <label htmlFor={`${formId}-time`}>记录时间</label>
          <input
            id={`${formId}-time`}
            name="recordedAt"
            type="datetime-local"
            value={current.recordedAt}
            max={localDateTime()}
            onChange={(e) => update({ recordedAt: e.target.value })}
            onInput={(e) => update({ recordedAt: e.currentTarget.value })}
            onBlur={(e) => update({ recordedAt: e.currentTarget.value })}
          />
          <p>留空即记录当前时间；补记会按所选日期计入趋势。</p>
          {current.recordedAt && (
            <button
              type="button"
              className="text-button"
              onClick={() => update({ recordedAt: '' })}
            >
              改为当前时间
            </button>
          )}
        </details>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-bottom">
          <span>
            <LockKeyhole size={13} /> 只保存在你的浏览器
          </span>
          <button className="button primary" type="submit" disabled={busy}>
            {loading ? '正在读取…' : busy ? '正在保存…' : initial ? '保存修改' : '记下这一刻'}
            <Pencil size={15} />
          </button>
        </div>
      </fieldset>
    </form>
  );
}
