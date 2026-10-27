import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  CloudRain,
  Flower2,
  Heart,
  LayoutGrid,
  Leaf,
  LockKeyhole,
  MoveUpRight,
  Pause,
  Pencil,
  Play,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Sun,
  Trash2,
  TrendingUp,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import {
  activities,
  dayKey,
  emptyData,
  feedbackLabels,
  inDays,
  makeDemo,
  moods,
  parseBackup,
  recommendations,
  tagCounts,
  filterEntries,
  recommendationReason,
  type Activity,
  type Entry,
  type Feedback,
  type JournalData,
  type MoodId,
} from './model';
import { loadData, saveData } from './storage';
import { useDraft } from './draft';
import EntryForm from './components/EntryForm';
import MoodFace from './components/MoodFace';
import TrendChart from './components/TrendChart';

type Page = 'today' | 'journal' | 'insights' | 'care';
const pages = [
  { id: 'today', label: '今天', sub: '留一点时间给自己', icon: LayoutGrid },
  { id: 'journal', label: '日记', sub: '每一种感受，都值得被记录', icon: BookOpen },
  { id: 'insights', label: '发现', sub: '慢慢读懂，自己的情绪', icon: TrendingUp },
  { id: 'care', label: '关怀', sub: '从一件小事开始，照顾自己', icon: Heart },
] as const;
const getPage = (): Page =>
  pages.some((p) => `#${p.id}` === location.hash) ? (location.hash.slice(1) as Page) : 'today';
const dateLabel = (date: string, withTime = false) =>
  new Date(date).toLocaleString('zh-CN', {
    month: 'long',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
const newId = () => crypto.randomUUID();

function ActivityIcon({ activity, size = 24 }: { activity: Activity; size?: number }) {
  const Icon =
    activity.icon === 'wind'
      ? Wind
      : activity.icon === 'rain'
        ? CloudRain
        : activity.icon === 'move'
          ? Flower2
          : activity.icon === 'sun'
            ? Sun
            : Leaf;
  return <Icon size={size} strokeWidth={1.6} />;
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="关闭弹窗">
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function ActivityCard({
  activity,
  onStart,
  featured = false,
}: {
  activity: Activity;
  onStart: (a: Activity) => void;
  featured?: boolean;
}) {
  return (
    <button
      className={`activity-card tone-${activity.tone} ${featured ? 'featured' : ''}`}
      onClick={() => onStart(activity)}
    >
      <span className="activity-symbol">
        <ActivityIcon activity={activity} size={featured ? 36 : 23} />
      </span>
      <span className="activity-content">
        <span className="activity-type">
          {activity.type} · {activity.minutes} 分钟
        </span>
        <strong>{activity.name}</strong>
        <span className="activity-subtitle">{activity.subtitle}</span>
      </span>
      <span className="activity-play">
        <Play size={15} fill="currentColor" />
      </span>
    </button>
  );
}

function EntryCard({
  entry,
  demo,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  demo: boolean;
  onEdit: (e: Entry) => void;
  onDelete: (e: Entry) => void;
}) {
  return (
    <article className="journal-card">
      <div className="journal-card-top">
        <span className="journal-date">
          {dateLabel(entry.date, true)}
          {demo && <em>示例</em>}
        </span>
        <div className="journal-actions">
          {!demo && (
            <>
              <button
                className="icon-button"
                aria-label={`编辑${dateLabel(entry.date)}的日记`}
                onClick={() => onEdit(entry)}
              >
                <Pencil size={15} />
              </button>
              <button
                className="icon-button danger-icon"
                aria-label={`删除${dateLabel(entry.date)}的日记`}
                onClick={() => onDelete(entry)}
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="journal-moods">
        {entry.moods.map((id) => (
          <span key={id}>
            <MoodFace mood={id} small />
            {moods.find((m) => m.id === id)!.label}
          </span>
        ))}
        <span className="intensity-pill">强度 {entry.intensity}/5</span>
      </div>
      <p className="journal-text">{entry.text || '这一次，让情绪本身成为记录。'}</p>
      <div className="journal-tags">
        {entry.tags.map((tag) => (
          <span key={tag}>#{tag}</span>
        ))}
      </div>
    </article>
  );
}

function ActivitySession({
  activity,
  onClose,
  onFeedback,
  busy,
}: {
  activity: Activity;
  onClose: () => void;
  onFeedback: (feedback: Feedback) => Promise<boolean>;
  busy: boolean;
}) {
  const [remaining, setRemaining] = useState(activity.minutes * 60);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const deadline = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!running) return;
    const update = () => {
      const rest = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(rest);
      if (!rest) {
        setRunning(false);
        setFinished(true);
      }
    };
    update();
    const interval = window.setInterval(update, 250);
    return () => clearInterval(interval);
  }, [running]);
  useEffect(() => {
    if (!running) {
      void audioRef.current?.close().catch(() => {});
      audioRef.current = null;
      setAudioOn(false);
    }
  }, [running]);
  useEffect(
    () => () => {
      void audioRef.current?.close().catch(() => {});
    },
    [],
  );
  const toggleAudio = async () => {
    setAudioError('');
    if (audioRef.current) {
      await audioRef.current.close();
      audioRef.current = null;
      setAudioOn(false);
      return;
    }
    try {
      const context = new AudioContext();
      audioRef.current = context;
      await context.resume();
      const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 750;
      const gain = context.createGain();
      gain.gain.value = 0.12;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      source.start();
      setAudioOn(true);
    } catch {
      void audioRef.current?.close().catch(() => {});
      audioRef.current = null;
      setAudioOn(false);
      setAudioError('当前浏览器无法播放声音，你仍可以使用休息计时。');
    }
  };
  const close = () => {
    if (running || (remaining < activity.minutes * 60 && !finished)) setConfirmClose(true);
    else onClose();
  };
  return (
    <Modal title={activity.name} onClose={close}>
      <div className="session-kind">
        <ActivityIcon activity={activity} size={18} />
        {activity.type} · {activity.minutes} 分钟 · 随时可以停止
      </div>
      {confirmClose ? (
        <div className="session-close">
          <p>结束这次练习吗？这次计时不会记录，已经保存的日记不受影响。</p>
          <div className="button-row">
            <button className="button secondary" onClick={() => setConfirmClose(false)}>
              继续练习
            </button>
            <button className="button primary" onClick={onClose}>
              结束并关闭
            </button>
          </div>
        </div>
      ) : finished ? (
        <div className="feedback-panel">
          <span className="feedback-flower">
            <Flower2 size={45} strokeWidth={1.2} />
          </span>
          <h3>谢谢你，留了时间给自己</h3>
          <p>此刻的感受有变化吗？每一种答案都可以。</p>
          <div className="feedback-options">
            {(['better', 'same', 'worse'] as Feedback[]).map((f) => (
              <button
                disabled={busy}
                className="button secondary"
                key={f}
                onClick={() => void onFeedback(f)}
              >
                {feedbackLabels[f]}
              </button>
            ))}
          </div>
          <button className="text-button" onClick={onClose}>
            暂不记录，关闭
          </button>
        </div>
      ) : (
        <>
          <div
            className={`breathing-orb ${running && activity.id === 'breathe' ? 'breathing' : ''}`}
          >
            <span>
              {String(Math.floor(remaining / 60)).padStart(2, '0')}:
              {String(remaining % 60).padStart(2, '0')}
            </span>
            <small>
              {running
                ? activity.id === 'breathe'
                  ? '自然呼吸，跟随自己的节奏'
                  : '此刻，只需陪着自己'
                : '准备好时，再开始'}
            </small>
          </div>
          <ol className="session-steps">
            {activity.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {activity.id === 'rain' && (
            <>
              <button
                className="button secondary sound-button"
                disabled={!running}
                onClick={() => void toggleAudio()}
              >
                {audioOn ? <VolumeX size={17} /> : <Volume2 size={17} />}
                {audioOn ? '关闭雨声' : '播放合成雨声'}
              </button>
              <p className="helper-text">声音在浏览器内合成，无需下载；开始计时后可播放。</p>
              {audioError && (
                <p role="alert" className="form-error">
                  {audioError}
                </p>
              )}
            </>
          )}
          <div className="session-controls">
            <button
              className="button primary"
              onClick={() => {
                if (running) {
                  setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
                  setRunning(false);
                } else {
                  deadline.current = Date.now() + remaining * 1000;
                  setRunning(true);
                }
              }}
            >
              {running ? <Pause size={17} /> : <Play size={17} />}
              {running ? '暂停一下' : remaining < activity.minutes * 60 ? '继续练习' : '开始练习'}
            </button>
            <button
              className="text-button"
              onClick={() => {
                setRunning(false);
                setFinished(true);
              }}
            >
              提前结束并反馈
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function App() {
  const [data, setData] = useState<JournalData>(emptyData);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [demo, setDemo] = useState(false);
  const [page, setPage] = useState<Page>(getPage);
  const [days, setDays] = useState(7);
  const draft = useDraft();
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('');
  const [moodFilter, setMoodFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('全部');
  const [durationFilter, setDurationFilter] = useState('all');
  const [quietOnly, setQuietOnly] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [settings, setSettings] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    text: string;
    action: () => Promise<void>;
  } | null>(null);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);
  const notify = (message: string, error = false) => {
    setToastError(error);
    setToast(message);
  };
  const [demoData] = useState(makeDemo);
  const fileRef = useRef<HTMLInputElement>(null);
  const shown = demo ? demoData : data;
  const recent = inDays(shown.entries, days);
  const sorted = [...shown.entries].sort((a, b) => b.date.localeCompare(a.date));
  const recommended = recommendations(shown.entries, shown.sessions);
  const filtered = filterEntries(shown.entries, {
    mood: moodFilter,
    query,
    days: dateFilter === 'all' ? null : Number(dateFilter),
    tag: tagFilter,
  });
  const resetJournalFilters = () => {
    setQuery('');
    setMoodFilter('all');
    setDateFilter('all');
    setTagFilter('');
  };
  const currentPage = pages.find((p) => p.id === page)!;

  const initialize = async () => {
    setStorageError('');
    setReady(false);
    try {
      const loaded = await loadData();
      setData(loaded);
      setDemo(!loaded.entries.length && !loaded.sessions.length && !draft.hasContent);
      setReady(true);
    } catch (e) {
      setStorageError((e as Error).message);
    }
  };
  useEffect(() => {
    void initialize();
    const listener = () => setPage(getPage());
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(id);
  }, [toast]);

  const mutate = async (update: (old: JournalData) => JournalData, success: string) => {
    if (!ready || saving.current) return false;
    saving.current = true;
    setBusy(true);
    try {
      const operation = async () => {
        const latest = await loadData();
        const next = update(latest);
        await saveData(next);
        setData(next);
      };
      if (navigator.locks) await navigator.locks.request('xinqing-journal-write', operation);
      else await operation();
      notify(success);
      return true;
    } catch (e) {
      notify((e as Error).message || '操作失败，请重试。', true);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const saveEntry = async (entry: Entry) => {
    const ok = await mutate(
      (old) => ({ ...old, entries: [...old.entries.filter((e) => e.id !== entry.id), entry] }),
      '这一刻，已经好好保存。',
    );
    if (ok) {
      setDemo(false);
      setEditing(null);
    }
    return ok;
  };
  const deleteEntry = (entry: Entry) =>
    setConfirmation({
      title: '删除这条日记？',
      text: '删除后无法直接恢复。你可以先在隐私与数据中导出备份。',
      action: async () => {
        if (
          await mutate(
            (old) => ({ ...old, entries: old.entries.filter((e) => e.id !== entry.id) }),
            '这条日记已删除。',
          )
        )
          setConfirmation(null);
      },
    });
  const navigate = (target: Page) => {
    location.hash = target;
    setPage(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const exportData = () => {
    const blob = new Blob(
      [JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `心晴备份-${dayKey(new Date())}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('已导出个人数据，请妥善保管备份文件。');
  };
  const importFile = async (file: File) => {
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('请选择小于 5 MB 的 JSON 备份。');
      const imported = parseBackup(JSON.parse(await file.text()));
      setConfirmation({
        title: '合并这份备份？',
        text: `备份包含 ${imported.entries.length} 条日记和 ${imported.sessions.length} 条关怀反馈。同编号的现有记录保留，其余记录会加入。`,
        action: async () => {
          const ok = await mutate(
            (old) => ({
              entries: [
                ...old.entries,
                ...imported.entries.filter(
                  (e) => !old.entries.some((current) => current.id === e.id),
                ),
              ],
              sessions: [
                ...old.sessions,
                ...imported.sessions.filter(
                  (s) => !old.sessions.some((current) => current.id === s.id),
                ),
              ],
            }),
            '备份已合并。',
          );
          if (ok) {
            setDemo(false);
            setConfirmation(null);
          }
        },
      });
    } catch (e) {
      notify(`导入失败：${(e as Error).message}`, true);
    }
  };

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        跳到主要内容
      </a>
      <aside className="sidebar">
        <a className="brand" href="#today" aria-label="心晴首页">
          <span className="brand-icon">
            <Sprout size={27} strokeWidth={1.7} />
          </span>
          <span>
            <strong>
              心晴<span className="brand-dot">.</span>
            </strong>
            <small>A LITTLE SPACE FOR YOU</small>
          </span>
        </a>
        <div className="nav-caption">我的情绪空间</div>
        <nav aria-label="主导航">
          {pages.map((p) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              className={`nav-item ${page === p.id ? 'active' : ''}`}
              aria-current={page === p.id ? 'page' : undefined}
            >
              <p.icon size={19} strokeWidth={1.7} />
              <span>{p.label}</span>
              {page === p.id && <i />}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-plant">
            <Leaf size={26} strokeWidth={1.4} />
          </span>
          <p>
            不必每天都晴朗，
            <br />
            阴天也值得被拥抱。
          </p>
          <span>给自己，多一点耐心。</span>
        </div>
        <button className="sidebar-settings" onClick={() => setSettings(true)}>
          <Settings2 size={18} />
          隐私与数据
        </button>
        <div className="sidebar-private">
          <ShieldCheck size={13} />
          你的感受，只属于你
        </div>
      </aside>
      <main className="main-content" id="main" tabIndex={-1}>
        <header className="topbar">
          <div className="breadcrumb">
            我的空间<span>/</span>
            <strong>{currentPage.label}</strong>
          </div>
          <div className="topbar-right">
            <span className={`local-status ${storageError ? 'unavailable' : ''}`}>
              <span />
              {storageError ? '存储不可用' : ready ? '本地私密保存' : '正在读取'}
            </span>
            <button
              className="avatar"
              aria-label="打开隐私与数据"
              onClick={() => setSettings(true)}
            >
              <Sprout size={20} />
            </button>
          </div>
        </header>
        <div className="page-content">
          <div className="page-title">
            <div>
              <p className="eyebrow">
                {page === 'today'
                  ? new Date().toLocaleDateString('zh-CN', {
                      month: 'long',
                      day: 'numeric',
                      weekday: 'long',
                    })
                  : 'YOUR LITTLE SPACE'}
              </p>
              <h1>
                {page === 'today' ? '今天，照顾一下自己' : currentPage.sub}
                <span className="title-dot">.</span>
              </h1>
              <p>
                {page === 'today'
                  ? '无论此刻是什么心情，这里都愿意听你说。'
                  : page === 'journal'
                    ? '留下那些经过你的时刻，也慢慢看见自己的变化。'
                    : page === 'insights'
                      ? '从记录里寻找线索，不急着为自己下结论。'
                      : '不需要立刻好起来，先给自己一个小小的停顿。'}
              </p>
            </div>
            <button
              className={`view-toggle ${demo ? 'demo-on' : ''}`}
              disabled={!ready}
              onClick={() => setDemo(!demo)}
              title={demo ? '切换到我的记录' : '切换到示例预览'}
            >
              {demo ? <Sparkles size={15} /> : <BookOpen size={15} />}
              {demo ? '示例预览' : '我的记录'}
              <ChevronRight size={14} />
            </button>
          </div>
          {!ready && (
            <div
              className={`system-banner ${storageError ? 'error' : ''}`}
              role={storageError ? 'alert' : 'status'}
            >
              {storageError || '正在打开你的情绪空间…'}
              {storageError && (
                <button className="text-button" onClick={() => void initialize()}>
                  重新尝试
                </button>
              )}
            </div>
          )}
          {ready && demo && (
            <div className="demo-banner">
              <span>
                <Sparkles size={15} />
                <strong>正在浏览示例</strong>
                <span>示例不会写入你的个人日记。</span>
              </span>
              <button
                onClick={() => {
                  setDemo(false);
                  navigate('today');
                }}
              >
                开始我的记录
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {page === 'today' && (
            <>
              <section className="welcome-banner">
                <div>
                  <span className="mini-label">
                    <Sun size={14} /> 给情绪，一个安放的地方
                  </span>
                  <h2>让情绪，被温柔看见。</h2>
                  <p>
                    开心可以分享，疲惫也可以被好好接住。
                    <br />
                    从记下此刻开始，慢慢靠近自己。
                  </p>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="sun-orbit orbit-one" />
                  <div className="sun-orbit orbit-two" />
                  <div className="hero-sun" />
                  <svg viewBox="0 0 200 180">
                    <path d="M100 180 Q90 115 127 41 M104 129 Q69 126 64 96 Q99 93 104 129 M108 105 Q143 107 157 79 Q124 73 108 105 M119 69 Q91 60 94 32 Q124 40 119 69" />
                  </svg>
                  <span className="art-star star-one">✦</span>
                  <span className="art-star star-two">✧</span>
                </div>
              </section>
              <div className="dashboard-grid">
                <div className="dashboard-left">
                  <section className="card record-card">
                    <div className="section-heading">
                      <div>
                        <span className="section-kicker">CHECK IN</span>
                        <h2>和自己，打个招呼</h2>
                      </div>
                      <span className="subtle-pill">
                        <Clock3 size={12} />约 30 秒
                      </span>
                    </div>
                    <EntryForm
                      draft={draft}
                      loading={!ready}
                      busy={!ready || busy}
                      compact
                      onSave={saveEntry}
                    />
                  </section>
                  <section className="card trend-card">
                    <div className="section-heading">
                      <div>
                        <span className="section-kicker">YOUR EMOTIONAL WEATHER</span>
                        <h2>最近的情绪天气</h2>
                      </div>
                      <button className="text-button" onClick={() => navigate('insights')}>
                        查看发现
                        <ArrowRight size={14} />
                      </button>
                    </div>
                    <TrendChart entries={shown.entries} />
                  </section>
                </div>
                <div className="dashboard-right">
                  <section className="care-preview">
                    <div className="section-heading">
                      <div>
                        <span className="section-kicker">A MOMENT FOR YOU</span>
                        <h2>给自己，一点关怀</h2>
                      </div>
                      <Heart size={18} strokeWidth={1.5} />
                    </div>
                    <p className="section-description recommendation-reason">
                      {demo && '示例推荐 · '}
                      {recommendationReason(recommended[0], shown.entries, shown.sessions)}
                    </p>
                    <ActivityCard activity={recommended[0]} onStart={setActivity} featured />
                    <div className="mini-activities">
                      {recommended.slice(1, 3).map((a) => (
                        <ActivityCard key={a.id} activity={a} onStart={setActivity} />
                      ))}
                    </div>
                    <button className="care-more" onClick={() => navigate('care')}>
                      探索更多关怀方式
                      <ArrowRight size={15} />
                    </button>
                  </section>
                  <section className="card recent-card">
                    <div className="section-heading">
                      <h2>最近的一页</h2>
                      <button
                        className="icon-button"
                        onClick={() => navigate('journal')}
                        aria-label="查看全部日记"
                      >
                        <MoveUpRight size={17} />
                      </button>
                    </div>
                    {sorted[0] ? (
                      <>
                        <span className="recent-date">
                          {dateLabel(sorted[0].date)}
                          {demo && ' · 示例'}
                        </span>
                        <div className="recent-mood">
                          <MoodFace mood={sorted[0].moods[0]} small />
                          <span>{moods.find((m) => m.id === sorted[0].moods[0])!.label}</span>
                        </div>
                        <p>{sorted[0].text || '这一天，情绪被好好记住了。'}</p>
                        <button className="text-button" onClick={() => navigate('journal')}>
                          翻开日记
                          <ArrowRight size={14} />
                        </button>
                      </>
                    ) : (
                      <div className="empty-recent">
                        <BookOpen size={28} strokeWidth={1.3} />
                        <p>你的故事，从第一条记录开始。</p>
                      </div>
                    )}
                  </section>
                  <div className="gentle-note">
                    <span>“</span>
                    <p>
                      允许一切发生，
                      <br />
                      也允许自己慢慢来。
                    </p>
                    <small>今天的小小提醒</small>
                  </div>
                </div>
              </div>
            </>
          )}

          {page === 'journal' && (
            <>
              <div className="journal-toolbar">
                <label className="search-label">
                  <BookOpen size={17} />
                  <input
                    aria-label="搜索日记或事件标签"
                    placeholder="搜索日记或事件标签…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="按情绪筛选"
                  value={moodFilter}
                  onChange={(e) => setMoodFilter(e.target.value)}
                >
                  <option value="all">全部情绪</option>
                  {moods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="按日记时间筛选"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                >
                  <option value="all">全部时间</option>
                  <option value="7">近 7 天</option>
                  <option value="30">近 30 天</option>
                </select>
                <button className="button primary" onClick={() => navigate('today')}>
                  <Plus size={16} />
                  记录此刻
                </button>
              </div>
              <div className="list-heading">
                <span>
                  {demo ? '示例日记' : '我的日记'} · {filtered.length} 条
                </span>
                <span>按时间倒序</span>
              </div>
              {(query || moodFilter !== 'all' || dateFilter !== 'all' || tagFilter) && (
                <div className="active-filters">
                  {tagFilter && (
                    <button onClick={() => setTagFilter('')}>
                      事件：#{tagFilter}
                      <X size={12} />
                    </button>
                  )}
                  <span>当前为筛选结果</span>
                  <button onClick={resetJournalFilters}>清除所有筛选</button>
                </div>
              )}
              <div className="journal-grid">
                {filtered.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    demo={demo}
                    onEdit={setEditing}
                    onDelete={deleteEntry}
                  />
                ))}
              </div>
              {!filtered.length && (
                <div className="empty-state">
                  <BookOpen size={38} strokeWidth={1.2} />
                  <h2>{sorted.length ? '暂时没有匹配的记录' : '给此刻，留下一页'}</h2>
                  <p>
                    {sorted.length
                      ? '换一个关键词，或选择其他情绪试试。'
                      : '不必写得完整，一种感受就足够。'}
                  </p>
                  {sorted.length ? (
                    <button className="button secondary" onClick={resetJournalFilters}>
                      清除筛选
                    </button>
                  ) : (
                    <button className="button primary" onClick={() => navigate('today')}>
                      开始第一条记录
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {page === 'insights' && (
            <>
              <div className="insights-toolbar">
                <span>每一条记录，都是认识自己的线索</span>
                <div className="segmented" aria-label="统计周期">
                  {[7, 30].map((d) => (
                    <button
                      aria-pressed={days === d}
                      className={days === d ? 'active' : ''}
                      key={d}
                      onClick={() => setDays(d)}
                    >
                      近 {d} 天
                    </button>
                  ))}
                </div>
              </div>
              <div className="stats-grid">
                <div className="stat-card">
                  <span>
                    记录下的时刻
                    <BookOpen size={17} />
                  </span>
                  <strong>
                    {recent.length}
                    <small>条</small>
                  </strong>
                  <p>每一次表达，都值得被看见</p>
                </div>
                <div className="stat-card">
                  <span>
                    留下记录的日子
                    <Sun size={18} />
                  </span>
                  <strong>
                    {new Set(recent.map((e) => dayKey(e.date))).size}
                    <small>天</small>
                  </strong>
                  <p>没有记录的日子也可以好好过</p>
                </div>
                <div className="stat-card">
                  <span>
                    关怀体验反馈
                    <Heart size={18} />
                  </span>
                  <strong>
                    {inDays(shown.sessions, days).length}
                    <small>次</small>
                  </strong>
                  <p>留意哪些方式更适合你</p>
                </div>
              </div>
              <section className="card">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">EVERY FEELING COUNTS</span>
                    <h2>情绪强度的变化</h2>
                  </div>
                  <span className="subtle-pill">近 {days} 天</span>
                </div>
                <TrendChart entries={shown.entries} days={days} />
              </section>
              <div className="insights-grid">
                <section className="card">
                  <div className="section-heading">
                    <h2>遇见了哪些情绪</h2>
                    <Flower2 size={18} />
                  </div>
                  <p className="section-description">一条记录可包含多种情绪，按出现次数统计。</p>
                  <div className="mood-bars">
                    {moods.map((m) => {
                      const count = recent.filter((e) => e.moods.includes(m.id)).length;
                      return (
                        <div className="mood-bar" key={m.id}>
                          <span>
                            <MoodFace mood={m.id} small />
                            {m.label}
                          </span>
                          <div>
                            <i
                              style={{
                                width: `${recent.length ? (count / recent.length) * 100 : 0}%`,
                                background: m.color,
                              }}
                            />
                          </div>
                          <b>{count} 次</b>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <section className="card triggers-card">
                  <div className="section-heading">
                    <h2>可能有关的生活片段</h2>
                    <Leaf size={18} />
                  </div>
                  <p className="section-description">点击事件标签，回看对应时段的原始日记。</p>
                  {tagCounts(recent).length ? (
                    <div className="trigger-list">
                      {tagCounts(recent)
                        .slice(0, 5)
                        .map(([tag, count]) => (
                          <button
                            key={tag}
                            aria-label={`查看近${days}天带有${tag}标签的${count}条日记`}
                            onClick={() => {
                              setTagFilter(tag);
                              setQuery('');
                              setMoodFilter('all');
                              setDateFilter(String(days));
                              navigate('journal');
                            }}
                          >
                            <span>#{tag}</span>
                            <strong>
                              {count}
                              <small> 条记录</small>
                              <ChevronRight size={14} />
                            </strong>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <p className="inline-empty">记录时添加事件标签，线索会慢慢出现。</p>
                  )}
                  <div className="insight-callout">
                    <Sparkles size={18} />
                    <p>
                      {recent.length < 3
                        ? `当前有 ${recent.length} 条记录，线索还不够丰富。可以按自己的节奏继续记录。`
                        : (() => {
                            const anxious = recent.filter((e) => e.moods.includes('anxious'));
                            const top = tagCounts(anxious)[0];
                            return top
                              ? `近 ${days} 天的 ${anxious.length} 条焦虑记录中，有 ${top[1]} 条带有“${top[0]}”标签。它们是否有关，只有你最了解。`
                              : `近 ${days} 天记录了 ${recent.length} 个时刻。可以回看具体情境，留意哪些事情反复出现。`;
                          })()}
                    </p>
                  </div>
                  <p className="helper-text">规则统计 · 共同出现不代表因果，不作心理诊断。</p>
                </section>
              </div>
              <section className="card session-history">
                <div className="section-heading">
                  <h2>关怀后的感受</h2>
                  <Heart size={18} />
                </div>
                {inDays(shown.sessions, days).length ? (
                  [...inDays(shown.sessions, days)]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 10)
                    .map((session) => (
                      <div className="session-history-row" key={session.id}>
                        <span>{activities.find((a) => a.id === session.activityId)?.name}</span>
                        <span>{feedbackLabels[session.feedback]}</span>
                        <small>{dateLabel(session.date, true)}</small>
                      </div>
                    ))
                ) : (
                  <p className="inline-empty">体验一个关怀活动后，可以在这里回看自己的反馈。</p>
                )}
              </section>
            </>
          )}

          {page === 'care' && (
            <>
              <div className="care-intro">
                <span className="care-intro-icon">
                  <Heart size={29} strokeWidth={1.4} />
                </span>
                <div>
                  <h2>你不需要一直很有力量</h2>
                  <p>选一个此刻愿意尝试的小活动，随时可以暂停或结束。</p>
                </div>
              </div>
              <div className="care-filters">
                <div className="filter-chips">
                  {['全部', '冥想', '音乐', '运动'].map((type) => (
                    <button
                      key={type}
                      aria-pressed={type === typeFilter}
                      className={type === typeFilter ? 'active' : ''}
                      onClick={() => setTypeFilter(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <div className="care-filter-right">
                  <select
                    aria-label="按活动时长筛选"
                    value={durationFilter}
                    onChange={(e) => setDurationFilter(e.target.value)}
                  >
                    <option value="all">不限时长</option>
                    <option value="2">2 分钟</option>
                    <option value="5">5 分钟以内</option>
                    <option value="10">10 分钟以内</option>
                  </select>
                  <label className="quiet-toggle">
                    <input
                      type="checkbox"
                      checked={quietOnly}
                      onChange={(e) => setQuietOnly(e.target.checked)}
                    />
                    无需出声
                  </label>
                </div>
              </div>
              <p className="recommendation-note">
                <Sparkles size={15} />
                {demo
                  ? '示例推荐 · 根据示例记录演示排序，不使用你的个人数据。'
                  : data.entries.length || data.sessions.length
                    ? '按最近记录与个人反馈，使用规则调整展示顺序。'
                    : '先从简单的活动开始，记录反馈后可调整推荐顺序。'}
              </p>
              <div className="care-grid">
                {recommended
                  .filter(
                    (a) =>
                      (typeFilter === '全部' || a.type === typeFilter) &&
                      (durationFilter === 'all' || a.minutes <= Number(durationFilter)) &&
                      (!quietOnly || a.quiet),
                  )
                  .map((a) => (
                    <div className="care-grid-item" key={a.id}>
                      <ActivityCard activity={a} onStart={setActivity} featured />
                      <div className="care-grid-caption">
                        <span>
                          <Clock3 size={13} />
                          {a.minutes} 分钟
                        </span>
                        <span>{a.quiet ? '安静的空间也适合' : '建议佩戴耳机'}</span>
                      </div>
                      <p className="activity-reason">
                        {recommendationReason(a, shown.entries, shown.sessions)}
                      </p>
                    </div>
                  ))}
              </div>
              {!recommended.some(
                (a) =>
                  (typeFilter === '全部' || a.type === typeFilter) &&
                  (durationFilter === 'all' || a.minutes <= Number(durationFilter)) &&
                  (!quietOnly || a.quiet),
              ) && (
                <div className="empty-state">
                  <Leaf size={35} />
                  <h2>换一种筛选试试</h2>
                  <p>当前没有同时满足这些条件的活动。</p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setTypeFilter('全部');
                      setDurationFilter('all');
                      setQuietOnly(false);
                    }}
                  >
                    重置筛选
                  </button>
                </div>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <Sprout size={15} />
              心晴 · 给自己一点温柔
            </span>
            <span>自我关怀支持 · 不替代专业帮助</span>
          </footer>
        </div>
      </main>
      <nav className="mobile-nav" aria-label="移动端导航">
        {pages.map((p) => (
          <a
            href={`#${p.id}`}
            key={p.id}
            className={page === p.id ? 'active' : ''}
            aria-current={page === p.id ? 'page' : undefined}
          >
            <p.icon size={20} />
            <span>{p.label}</span>
          </a>
        ))}
      </nav>
      {editing && (
        <Modal
          title="再看看，那一刻的自己"
          wide
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <p className="modal-description">
            记录时间：{dateLabel(editing.date, true)}。你可以更新自己的感受和事件标签。
          </p>
          <EntryForm initial={editing} busy={busy || !ready} onSave={saveEntry} />
        </Modal>
      )}
      {activity && (
        <ActivitySession
          key={activity.id}
          activity={activity}
          busy={busy || !ready}
          onClose={() => {
            if (!busy) setActivity(null);
          }}
          onFeedback={async (feedback) => {
            const id = activity.id;
            const ok = await mutate(
              (old) => ({
                ...old,
                sessions: [
                  ...old.sessions,
                  { id: newId(), date: new Date().toISOString(), activityId: id, feedback },
                ],
              }),
              '感受已记录，谢谢你照顾自己。',
            );
            if (ok) {
              setActivity(null);
              setDemo(false);
            }
            return ok;
          }}
        />
      )}
      {settings && (
        <Modal
          title="隐私与数据"
          onClose={() => {
            if (!busy) setSettings(false);
          }}
        >
          <div className="privacy-callout">
            <ShieldCheck size={25} />
            <div>
              <strong>你的日记，留在你的浏览器</strong>
              <p>不需要账号，不上传日记正文。使用当前网站的同一浏览器才能看到记录。</p>
            </div>
          </div>
          <p className="modal-description">
            清理网站数据、更换设备或使用无痕模式，可能无法保留记录。本地存储未加密，共用设备时请留意隐私，并定期导出备份。
          </p>
          <div className="data-summary">
            <span>
              个人日记<strong>{data.entries.length} 条</strong>
            </span>
            <span>
              关怀反馈<strong>{data.sessions.length} 条</strong>
            </span>
          </div>
          <div className="settings-action">
            <div>
              <strong>导出个人备份</strong>
              <p>JSON 格式，包含已保存的日记原文；不含示例和未提交草稿。</p>
            </div>
            <button disabled={!ready || busy} className="button secondary" onClick={exportData}>
              <ArrowDownToLine size={16} />
              导出
            </button>
          </div>
          <div className="settings-action">
            <div>
              <strong>导入备份</strong>
              <p>合并有效记录，保留同编号的已有内容。</p>
            </div>
            <button
              disabled={!ready || busy}
              className="button secondary"
              onClick={() => fileRef.current?.click()}
            >
              <ArrowUpFromLine size={16} />
              导入
            </button>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
                e.target.value = '';
              }}
            />
          </div>
          <div className="settings-action">
            <div>
              <strong>清空个人数据</strong>
              <p>删除本浏览器中的日记和活动反馈，无法直接撤销。</p>
            </div>
            <button
              disabled={
                !ready ||
                busy ||
                (!data.entries.length && !data.sessions.length && !draft.hasContent)
              }
              className="button danger"
              onClick={() =>
                setConfirmation({
                  title: '清空所有个人数据？',
                  text: '这将删除本浏览器中全部个人日记、关怀反馈及当前标签页的草稿。请先导出需要保留的日记备份。',
                  action: async () => {
                    if (await mutate(() => emptyData(), '个人数据已清空。')) {
                      draft.clear();
                      setDemo(false);
                      setConfirmation(null);
                    }
                  },
                })
              }
            >
              <Trash2 size={16} />
              清空
            </button>
          </div>
          <div className="about-note">
            <CircleHelp size={16} />
            <p>
              心晴 v0.2 ·
              原型版。趋势与推荐使用可解释规则，未接入大模型。网页可远程访问，个人数据不跨设备同步。
            </p>
          </div>
        </Modal>
      )}
      {confirmation && (
        <Modal
          title={confirmation.title}
          onClose={() => {
            if (!busy) setConfirmation(null);
          }}
        >
          <p className="modal-description">{confirmation.text}</p>
          <div className="button-row">
            <button
              disabled={busy}
              className="button secondary"
              onClick={() => setConfirmation(null)}
            >
              取消
            </button>
            <button
              disabled={busy}
              className="button primary"
              onClick={() => void confirmation.action()}
            >
              {busy ? '正在处理…' : '确认操作'}
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div
          className={`toast ${toastError ? 'error-toast' : ''}`}
          role={toastError ? 'alert' : 'status'}
        >
          {toastError ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{toast}</span>
          <button aria-label="关闭提示" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
