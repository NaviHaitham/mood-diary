import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, Leaf, Sprout } from 'lucide-react';
import './opening-book.css';

type Phase = 'closed' | 'opening' | 'leaving' | 'done';

/** A document-entry experience; navigating between journal pages does not replay it. */
export default function OpeningBook() {
  const [phase, setPhase] = useState<Phase>('closed');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const done = phase === 'done';
  const opening = phase === 'opening' || phase === 'leaving';

  useLayoutEffect(() => {
    if (done) {
      document.getElementById('main')?.focus({ preventScroll: true });
      return;
    }
    const dialog = dialogRef.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    document.getElementById('book-entry-title')?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = overflow;
    };
  }, [done]);

  useEffect(() => {
    if (phase === 'opening') {
      const timer = window.setTimeout(() => setPhase('leaving'), 2400);
      return () => clearTimeout(timer);
    }
    if (phase === 'leaving') {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const timer = window.setTimeout(() => setPhase('done'), reduced ? 80 : 480);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const open = () => {
    if (phase !== 'closed') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPhase(reduced ? 'leaving' : 'opening');
  };

  if (done) return null;
  return (
    <dialog
      ref={dialogRef}
      className={`book-entry ${opening ? 'is-opening' : ''} ${phase === 'leaving' ? 'is-leaving' : ''}`}
      aria-labelledby="book-entry-title"
      aria-describedby="book-entry-instruction"
      onCancel={(event) => {
        event.preventDefault();
        setPhase('leaving');
      }}
    >
      <div className="entry-grain" aria-hidden="true" />
      <span className="entry-corner-mark" aria-hidden="true">
        <Sprout size={24} strokeWidth={1.3} />
        心晴
      </span>
      <div className="entry-layout">
        <header className="entry-heading">
          <span className="entry-date">
            {new Date().toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </span>
          <h2 id="book-entry-title" tabIndex={-1}>
            给自己，留一点时间。
          </h2>
          <p>每一种感受，都值得被温柔记下。</p>
        </header>

        <div className="entry-scene">
          <span className="book-floor-shadow" aria-hidden="true" />
          <button
            className="diary-book"
            type="button"
            aria-label="打开心晴日记本"
            aria-describedby="book-entry-instruction"
            disabled={phase !== 'closed'}
            onClick={open}
          >
            <span className="book-rear-board" aria-hidden="true" />
            <span className="book-paper-stack" aria-hidden="true" />
            <span className="book-inside-page" aria-hidden="true">
              <span className="inside-topline">写给此刻的自己</span>
              <Leaf size={25} strokeWidth={1.1} />
              <span className="inside-title">
                今天的你，
                <br />
                也值得被好好照顾。
              </span>
              <span className="inside-rule" />
              <span className="inside-note">
                不必写得完整，
                <br />
                一种感受，就足够。
              </span>
              <span className="inside-signature">心晴 · 陪你慢慢来</span>
            </span>
            <span className="book-turning-sheet sheet-last" aria-hidden="true" />
            <span className="book-turning-sheet sheet-middle" aria-hidden="true" />
            <span className="book-turning-sheet sheet-first" aria-hidden="true" />
            <span className="book-front-cover" aria-hidden="true">
              <span className="cover-face cover-outside">
                <span className="cover-stitched-border" />
                <span className="cover-spine" />
                <span className="cover-edition">A LITTLE SPACE FOR YOU</span>
                <span className="cover-title">
                  心晴<span>日 记</span>
                </span>
                <span className="cover-subtitle">情绪日记 · 自我关怀</span>
                <svg className="cover-botanical" viewBox="0 0 130 140" fill="none">
                  <path d="M64 133C52 96 63 58 80 14" />
                  <path d="M62 112C39 111 27 98 25 80C45 80 62 91 62 112Z" />
                  <path d="M62 91C83 93 102 81 107 60C82 60 68 72 62 91Z" />
                  <path d="M69 68C48 65 39 49 42 31C63 38 70 51 69 68Z" />
                  <path d="M77 36C96 35 108 21 107 6C88 9 79 19 77 36Z" />
                  <circle cx="27" cy="38" r="2" />
                  <path d="M105 111V123M99 117H111" />
                </svg>
                <span className="cover-bottomline">让心事，在这里轻轻落下</span>
                <span className="cover-ribbon" />
              </span>
              <span className="cover-face cover-inside">
                <span className="inside-cover-frame">
                  <Sprout size={30} strokeWidth={1} />
                  <span>
                    不必每天都晴朗，
                    <br />
                    阴天也值得被拥抱。
                  </span>
                  <small>这一页，属于你。</small>
                </span>
              </span>
            </span>
          </button>
        </div>

        <footer className="entry-footer">
          <p id="book-entry-instruction" aria-live="polite">
            {opening ? '正在为你翻开日记…' : '轻点封面，翻开属于你的一页'}
          </p>
          <span className="entry-invitation" aria-hidden="true">
            <span />
            {opening ? '慢慢来，就很好' : '从此刻开始'}
            <span />
          </span>
          <button className="entry-skip" onClick={() => setPhase('leaving')}>
            直接进入
            <ArrowRight size={13} />
          </button>
        </footer>
      </div>
    </dialog>
  );
}
