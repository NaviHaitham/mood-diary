import { emptyData, type JournalData, parseBackup } from './model';

const DB = 'xinqing-journal';
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('journal');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本地存储，请检查浏览器设置。'));
    request.onblocked = () => reject(new Error('请关闭其他心晴页面后重试。'));
  });
}
export async function loadData(): Promise<JournalData> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('journal', 'readonly');
      const req = tx.objectStore('journal').get('data');
      tx.oncomplete = () => {
        try {
          resolve(req.result ? parseBackup({ ...req.result, version: 1 }) : emptyData());
        } catch {
          reject(new Error('本地记录无法读取。请勿清理浏览器数据，可先尝试刷新。'));
        }
      };
      tx.onerror = () => reject(new Error('读取失败，请重试。'));
      tx.onabort = () => reject(new Error('读取已中断，请重试。'));
    });
  } finally {
    db.close();
  }
}
export async function saveData(data: JournalData): Promise<void> {
  const validated = parseBackup({ version: 1, ...data });
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('journal', 'readwrite');
      tx.objectStore('journal').put(validated, 'data');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('保存失败，本地空间可能不足。请导出备份后重试。'));
      tx.onabort = () => reject(new Error('保存已中断，请重试。'));
    });
  } finally {
    db.close();
  }
}
