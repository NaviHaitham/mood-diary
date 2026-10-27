import type { CSSProperties } from 'react';
import { moods, type MoodId } from '../model';

export default function MoodFace({ mood, small = false }: { mood: MoodId; small?: boolean }) {
  const item = moods.find((m) => m.id === mood)!;
  return (
    <span
      aria-hidden="true"
      className={`mood-face ${small ? 'small' : ''} mood-${mood}`}
      style={{ '--face-color': item.color, '--face-bg': item.soft } as CSSProperties}
    >
      <i />
      <i />
      <b>{item.face}</b>
    </span>
  );
}
