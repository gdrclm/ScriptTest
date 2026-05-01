import type { GameState, Interaction, InteractionResult, QTEChoice, QTERecord } from './types';

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function clamp(value: number, min: number): number {
  return Math.max(min, value);
}

function updateRelationship(
  current: GameState['relationship'],
  delta?: Record<string, number>,
): GameState['relationship'] {
  if (!delta) {
    return current;
  }

  return Object.entries(delta).reduce(
    (next, [characterId, value]) => ({
      ...next,
      [characterId]: (next[characterId] ?? 0) + value,
    }),
    { ...current },
  );
}

function applyResult(state: GameState, result: InteractionResult): GameState {
  const flags = [...state.flags];
  if (result.addFlag) {
    flags.push(result.addFlag);
  }
  if (result.addFlags) {
    flags.push(...result.addFlags);
  }
  if (result.setFlag) {
    flags.push(result.setFlag);
  }

  const inventoryToAdd = result.addInventory
    ? Array.isArray(result.addInventory)
      ? result.addInventory
      : [result.addInventory]
    : [];
  const inventory = inventoryToAdd.length
    ? inventoryToAdd.reduce(
        (items, item) => (items.some((currentItem) => currentItem.id === item.id) ? items : [...items, item]),
        state.inventory,
      )
    : state.inventory.filter((item) => item.id !== result.removeInventory);

  return {
    ...state,
    flags: result.removeFlag
      ? unique(flags).filter((flag) => flag !== result.removeFlag)
      : unique(flags),
    inventory,
    chaosPoints: clamp(state.chaosPoints + (result.chaosDelta ?? 0), 0),
    suspicionLevel: clamp(state.suspicionLevel + (result.suspicionDelta ?? 0), 0),
    relationship: updateRelationship(state.relationship, result.relationshipDelta),
    timeRemaining: clamp(state.timeRemaining + (result.timeDelta ?? 0), 0),
    currentSceneId: result.sceneChange ?? state.currentSceneId,
  };
}

export class ActionResolver {
  static resolveInteraction(state: GameState, sceneId: string, objectId: string, interaction: Interaction): GameState {
    const examined = unique([...(state.examinedObjects[sceneId] ?? []), objectId]);
    const stateWithExamined = {
      ...state,
      examinedObjects: {
        ...state.examinedObjects,
        [sceneId]: examined,
      },
    };

    return applyResult(stateWithExamined, interaction.result);
  }

  static resolveQte(state: GameState, sceneId: string, choice: QTEChoice, timedOut = false): GameState {
    const record: QTERecord = {
      sceneId,
      action: timedOut ? 'timeout' : choice.action,
      success: Boolean(choice.result.qteSuccess) && !timedOut,
      timePenalty: timedOut || choice.result.qteSuccess === false ? Math.abs(choice.result.timeDelta ?? 0) : 0,
    };

    return {
      ...applyResult(state, choice.result),
      pendingQteSceneId: undefined,
      qteHistory: [...state.qteHistory, record],
    };
  }
}
