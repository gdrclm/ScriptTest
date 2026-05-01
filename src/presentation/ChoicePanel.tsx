import { CornerDownRight } from 'lucide-react';
import { useGame } from './GameContext';

export function ChoicePanel() {
  const { turn, performChoice, qte } = useGame();

  if (qte) {
    return null;
  }

  return (
    <nav className="choice-panel" aria-label="Доступные действия">
      {turn.choices.map((choice) => (
        <button key={choice.id} type="button" onClick={() => performChoice(choice)}>
          <CornerDownRight size={16} />
          <span>{choice.label}</span>
        </button>
      ))}
    </nav>
  );
}
