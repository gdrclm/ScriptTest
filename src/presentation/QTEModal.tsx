import { useEffect, useMemo, useState } from 'react';
import { Zap } from 'lucide-react';
import { useGame } from './GameContext';

export function QTEModal() {
  const { qte, performQte } = useGame();
  const [remaining, setRemaining] = useState(qte?.timeLimit ?? 0);

  useEffect(() => {
    if (!qte) {
      return;
    }

    setRemaining(qte.timeLimit);
    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      const next = Math.max(0, qte.timeLimit - (performance.now() - startedAt) / 1000);
      setRemaining(next);
      if (next <= 0) {
        window.clearInterval(interval);
        performQte(qte.choices[qte.choices.length - 1].action, true);
      }
    }, 80);

    return () => window.clearInterval(interval);
  }, [performQte, qte]);

  useEffect(() => {
    if (!qte) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && qte.choices[index]) {
        performQte(qte.choices[index].action);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [performQte, qte]);

  const progress = useMemo(() => {
    if (!qte) {
      return 0;
    }
    return `${Math.max(0, Math.min(100, (remaining / qte.timeLimit) * 100))}%`;
  }, [qte, remaining]);

  if (!qte) {
    return null;
  }

  return (
    <div className="qte-backdrop" role="dialog" aria-modal="true">
      <section className="qte-modal">
        <div className="qte-heading">
          <Zap size={22} />
          <h2>QTE</h2>
          <strong>{remaining.toFixed(1)} сек</strong>
        </div>
        <p>{qte.prompt}</p>
        <div className="qte-timer">
          <span style={{ width: progress }} />
        </div>
        <div className="qte-options">
          {qte.choices.map((choice, index) => (
            <button key={choice.action} type="button" onClick={() => performQte(choice.action)}>
              <kbd>{index + 1}</kbd>
              <span>{choice.text}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
