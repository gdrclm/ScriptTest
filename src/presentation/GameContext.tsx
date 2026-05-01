import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { gameData } from '../data/gameData';
import { GameController } from '../logic/GameController';
import type { Choice, GameState, QTEEvent, SceneData, TurnResult } from '../logic/types';

interface GameContextValue {
  state: GameState;
  scene: SceneData;
  turn: TurnResult;
  qte?: QTEEvent;
  performObjectAction: (objectId: string, action?: string) => void;
  performChoice: (choice: Choice) => void;
  performQte: (action: string, timedOut?: boolean) => void;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const controllerRef = useRef<GameController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new GameController(gameData);
  }

  const controller = controllerRef.current;
  const [turn, setTurn] = useState<TurnResult>(() => controller.getInitialTurn());
  const [qte, setQte] = useState<QTEEvent | undefined>(undefined);
  const [state, setState] = useState<GameState>(() => controller.getState());

  const commitTurn = useCallback((nextTurn: TurnResult) => {
    setTurn(nextTurn);
    setState(nextTurn.newState);
    setQte(nextTurn.qteTrigger);
  }, []);

  const performObjectAction = useCallback(
    (objectId: string, action = 'examine') => {
      commitTurn(controller.performAction(controller.getState().currentSceneId, objectId, action));
    },
    [commitTurn, controller],
  );

  const performChoice = useCallback(
    (choice: Choice) => {
      commitTurn(controller.performChoice(choice));
    },
    [commitTurn, controller],
  );

  const performQte = useCallback(
    (action: string, timedOut = false) => {
      commitTurn(controller.performQte(action, timedOut));
    },
    [commitTurn, controller],
  );

  const value = useMemo(
    () => ({
      state,
      scene: controller.getCurrentScene(),
      turn,
      qte,
      performObjectAction,
      performChoice,
      performQte,
    }),
    [controller, performChoice, performObjectAction, performQte, qte, state, turn],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used inside GameProvider.');
  }

  return context;
}
