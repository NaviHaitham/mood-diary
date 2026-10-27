export const moods = [
  { id: 'happy', label: '开心', face: '◡', color: '#d1a84d', soft: '#fbf3d9' },
  { id: 'calm', label: '平静', face: '—', color: '#6e957b', soft: '#e9f1e8' },
  { id: 'anxious', label: '焦虑', face: '﹏', color: '#aa8eaf', soft: '#f1eaf4' },
  { id: 'sad', label: '难过', face: '⌢', color: '#7c9bb9', soft: '#e9f0f8' },
  { id: 'angry', label: '生气', face: 'へ', color: '#c47e6d', soft: '#faeae3' },
  { id: 'tired', label: '疲惫', face: '﹏', color: '#a3927d', soft: '#f0ece6' },
] as const;

export type MoodId = typeof moods[number]['id'];
export type Entry = { id: string; date: string; moods: MoodId[]; intensity: number; tags: string[]; text: string };
export type Feedback = 'better' | 'same' | 'worse';
export type Session = { id: string; date: string; activityId: string; feedback: Feedback };
export type JournalData = { entries: Entry[]; sessions: Session[] };
export const tags = ['学业', '工作', '人际', '家庭', '睡眠', '身体', '生活小事'];
export const feedbackLabels: Record<Feedback, string> = { better: '舒服一些', same: '差不多', worse: '更不舒服' };
export const emptyData = (): JournalData => ({ entries: [], sessions: [] });

export const activities = [
  { id: 'breathe', name: '给自己一次深呼吸', type: '冥想', minutes: 2, icon: 'wind', tone: 'sage', subtitle: '跟随圆的节奏，慢慢回到当下', quiet: true, steps: ['找一个舒服的姿势，让双肩自然放松。', '跟随动画自然呼吸，无需屏息或用力。', '注意此刻的感受，走神也没有关系。'] },
  { id: 'rain', name: '在雨声里，停一会儿', type: '音乐', minutes: 5, icon: 'rain', tone: 'blue', subtitle: '一段雨声，让思绪有处安放', quiet: false, steps: ['把音量调到舒适的大小。', '点击播放，聆听浏览器合成的雨声；也可以静静休息。', '注意身边的声音，让想法自然经过。'] },
  { id: 'stretch', name: '让肩膀轻一点', type: '运动', minutes: 2, icon: 'move', tone: 'peach', subtitle: '离开屏幕，轻轻舒展身体', quiet: true, steps: ['选择安全、能自由活动的空间。', '按自己舒适的幅度轻轻活动肩膀、手腕，或站起来走动。', '感到不适时立即停止，随时可以坐下休息。'] },
  { id: 'ground', name: '发现身边的小美好', type: '冥想', minutes: 5, icon: 'leaf', tone: 'sand', subtitle: '把注意力交还给眼前的生活', quiet: true, steps: ['看看周围，找出三样你注意到的东西。', '感受脚下的地面，留意手边物品的触感。', '为自己留一段不需要完成任务的时间。'] },
  { id: 'walk', name: '去散一小会儿步', type: '运动', minutes: 10, icon: 'sun', tone: 'sage', subtitle: '以自己的步调，感受一点新鲜空气', quiet: true, steps: ['选择安全的路线，也可以在室内缓缓走动。', '用舒适的速度走，留意周围和身体的感受。', '无需追求距离和步数，想休息时就停下来。'] },
] as const;
export type Activity = typeof activities[number];

export function dayKey(date: string | Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function inDays<T extends { date: string }>(items: T[], days: number, now = new Date()): T[] {
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - days + 1);
  return items.filter(item => { const time = new Date(item.date).getTime(); return time >= start.getTime() && time <= now.getTime(); });
}
export function tagCounts(entries: Entry[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) for (const tag of new Set(entry.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}
export function trend(entries: Entry[], days: number, now = new Date()) {
  const recent = inDays(entries, days, now);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now); date.setDate(date.getDate() - days + index + 1);
    const records = recent.filter(e => dayKey(e.date) === dayKey(date));
    return { date: dayKey(date), label: `${date.getMonth() + 1}/${date.getDate()}`, count: records.length, value: records.length ? records.reduce((sum, e) => sum + e.intensity, 0) / records.length : null };
  });
}
export function recommendations(entries: Entry[], sessions: Session[]): Activity[] {
  const last = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
  return [...activities].map(activity => {
    let score = 0;
    if (last?.moods.includes('anxious') && activity.id === 'breathe') score += 3;
    if (last?.moods.includes('tired') && activity.id === 'stretch') score += 3;
    if (last?.moods.includes('sad') && activity.id === 'walk') score += 3;
    score += sessions.filter(s => s.activityId === activity.id && s.feedback === 'better').length * 2;
    score -= sessions.filter(s => s.activityId === activity.id && s.feedback === 'worse').length * 2;
    return { activity, score };
  }).sort((a, b) => b.score - a.score).map(item => item.activity);
}
export function makeDemo(now = new Date()): JournalData {
  const examples: [number, MoodId[], number, string[], string][] = [
    [6, ['anxious'], 4, ['工作'], '明天要做汇报，有点担心自己讲不好。先把提纲整理出来了。'],
    [5, ['calm'], 2, ['生活小事'], '下班路上看到一片好看的晚霞，停下来拍了张照片。'],
    [4, ['tired'], 4, ['工作', '睡眠'], '最近睡得有点晚，下午没什么精神。今晚想早点放下手机。'],
    [3, ['happy', 'calm'], 3, ['人际'], '和朋友吃了一顿简单的饭，聊完觉得轻松多了。'],
    [2, ['anxious'], 3, ['学业'], '想做的事情很多，今天先完成其中一件就好。'],
    [1, ['calm'], 2, ['生活小事'], '给自己留了十分钟散步。风吹过来的时候，心里安静了一点。'],
  ];
  return { entries: examples.map(([ago, selected, intensity, selectedTags, text], i) => {
    const date = new Date(now); date.setDate(date.getDate() - ago); date.setHours(18, 20 + i, 0, 0);
    return { id: `demo-${i}`, date: date.toISOString(), moods: selected, intensity, tags: selectedTags, text };
  }), sessions: [] };
}

export function parseBackup(input: unknown): JournalData {
  if (!input || typeof input !== 'object') throw new Error('备份格式不正确。');
  const data = input as Record<string, unknown>;
  if (data.version !== 1 || !Array.isArray(data.entries) || !Array.isArray(data.sessions)) throw new Error('请选择心晴导出的 JSON 备份。');
  if (data.entries.length > 5000 || data.sessions.length > 10000) throw new Error('备份记录数量过多。');
  const validDate = (d: unknown): d is string => typeof d === 'string' && d.length <= 40 && Number.isFinite(Date.parse(d));
  const validId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length < 150;
  const entries: Entry[] = data.entries.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('日记记录格式不正确。');
    const e = entry as Record<string, unknown>;
    if (!validId(e.id) || !validDate(e.date) || !Array.isArray(e.moods) || !e.moods.length || e.moods.length > moods.length || !e.moods.every(m => moods.some(item => item.id === m)) || !Number.isInteger(e.intensity) || Number(e.intensity) < 1 || Number(e.intensity) > 5 || !Array.isArray(e.tags) || e.tags.length > 12 || !e.tags.every(t => typeof t === 'string' && t.length <= 30) || typeof e.text !== 'string' || e.text.length > 3000) throw new Error('日记字段不符合要求，原有记录未更改。');
    return { id: e.id, date: new Date(e.date).toISOString(), moods: [...new Set(e.moods)] as MoodId[], intensity: Number(e.intensity), tags: [...new Set(e.tags)] as string[], text: e.text };
  });
  const sessions: Session[] = data.sessions.map((session: unknown) => {
    if (!session || typeof session !== 'object') throw new Error('活动记录格式不正确。');
    const s = session as Record<string, unknown>;
    if (!validId(s.id) || !validDate(s.date) || !activities.some(a => a.id === s.activityId) || !['better', 'same', 'worse'].includes(String(s.feedback))) throw new Error('活动字段不符合要求，原有记录未更改。');
    return { id: s.id, date: new Date(s.date).toISOString(), activityId: String(s.activityId), feedback: s.feedback as Feedback };
  });
  if (new Set(entries.map(e => e.id)).size !== entries.length || new Set(sessions.map(s => s.id)).size !== sessions.length) throw new Error('备份存在重复记录编号。');
  return { entries, sessions };
}
