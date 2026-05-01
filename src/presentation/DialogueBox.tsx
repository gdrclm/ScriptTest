import { useGame } from './GameContext';

export function DialogueBox() {
  const { turn } = useGame();

  return (
    <section className="dialogue">
      <p>{turn.displayText.text}</p>
    </section>
  );
}
