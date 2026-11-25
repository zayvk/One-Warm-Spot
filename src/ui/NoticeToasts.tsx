import { useEffect } from 'react';
import { useGameStore, type Notice } from '../game/store/useGameStore.ts';

const TOAST_MS = 4200;

/** Gentle top-center toasts (morning greetings, shelter unlocks) */
export default function NoticeToasts() {
  const notices = useGameStore((s) => s.notices);
  const dismissNotice = useGameStore((s) => s.dismissNotice);

  return (
    <div className="ows-toast-stack" role="status" aria-live="polite">
      {notices.slice(-3).map((n) => (
        <Toast key={n.id} notice={n} onDismiss={dismissNotice} />
      ))}
    </div>
  );
}

function Toast({ notice, onDismiss }: { notice: Notice; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notice.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [notice.id, onDismiss]);

  return (
    <button
      type="button"
      className={`ows-toast ows-toast--${notice.tone}`}
      onClick={() => onDismiss(notice.id)}
      title="Dismiss"
    >
      <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>
        {notice.icon}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: '0.98rem' }}>{notice.title}</strong>
        {notice.body && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{notice.body}</span>
        )}
      </span>
    </button>
  );
}
