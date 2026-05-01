import { Package } from 'lucide-react';
import { useGame } from './GameContext';

export function HUD() {
  const { state } = useGame();

  return (
    <header className="hud">
      <div className="threat-line">
        <span className="mini-mark">▸</span>
        <span>Стажёр</span>
        <span>•</span>
        <span>Уровень угрозы:</span>
        <strong>смехотворный</strong>
      </div>
      <div className="inventory">
        <Package size={22} />
        {state.inventory.length === 0 ? (
          <span className="inventory-empty">Пусто</span>
        ) : (
          state.inventory.map((item) => (
            <span key={item.id} title={item.hoverText}>
              {item.name}
            </span>
          ))
        )}
      </div>
    </header>
  );
}
