import { useCallback, useMemo } from 'react';
import { BookOpen, Building2, Save, Settings, Skull } from 'lucide-react';
import { evaluateCondition } from '../logic/conditions';
import { ChoicePanel } from './ChoicePanel';
import { DialogueBox } from './DialogueBox';
import { GameProvider, useGame } from './GameContext';
import { HUD } from './HUD';
import { PanoramaCanvas } from './PanoramaCanvas';
import { QTEModal } from './QTEModal';

function GameLayout() {
  const { scene, state, performObjectAction } = useGame();
  const handleHotspot = useCallback((objectId: string) => performObjectAction(objectId), [performObjectAction]);
  const isTimeOver = state.timeRemaining <= 0;
  const showMirrorCharacter = state.flags.includes('mirror_examined');
  const brandTitle = scene.title === 'Отдел кадров' ? 'ОТДЕЛ КАДРОВ' : 'ЗЛО ИНКОРПОРЕЙТЕД';
  const visibleObjectIds = useMemo(
    () =>
      scene.objects
        .filter((object) => object.position.radius > 1)
        .filter((object) => evaluateCondition(object.condition ?? 'always', state, scene))
        .map((object) => object.id),
    [scene, state],
  );

  return (
    <main className="game-shell">
      <section className="scene-area">
        <section className="stage">
          <PanoramaCanvas
            scene={scene}
            visibleObjectIds={visibleObjectIds}
            showMirrorCharacter={showMirrorCharacter}
            onHotspot={handleHotspot}
          />
        </section>
        <HUD />
      </section>
      <aside className="side-panel">
        <div className="brand">
          <Skull size={44} />
          <span>{brandTitle}</span>
        </div>
        <div className="location-strip">
          <h1>{scene.title}</h1>
          <Building2 size={25} />
        </div>
        <DialogueBox />
        {isTimeOver ? (
          <section className="ending">
            Роботизация завершилась раньше, чем отдел закупок согласовал продление заката.
          </section>
        ) : (
          <ChoicePanel />
        )}
        <div className="tool-row" aria-label="Служебные кнопки">
          <button type="button" title="Настройки">
            <Settings size={25} />
          </button>
          <button type="button" title="Сохранить">
            <Save size={25} />
          </button>
          <button type="button" title="Журнал">
            <BookOpen size={25} />
          </button>
        </div>
      </aside>
      <QTEModal />
    </main>
  );
}

export function GameScreen() {
  return (
    <GameProvider>
      <GameLayout />
    </GameProvider>
  );
}
