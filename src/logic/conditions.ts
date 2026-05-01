import type { GameState, SceneData } from './types';

export function hasFlag(state: GameState, flag: string): boolean {
  return state.flags.includes(flag);
}

export function evaluateCondition(condition: string, state: GameState, scene?: SceneData): boolean {
  if (!condition || condition === 'always') {
    return true;
  }

  if (condition.includes('&')) {
    return condition.split('&').every((part) => evaluateCondition(part.trim(), state, scene));
  }

  if (condition.includes('|')) {
    return condition.split('|').some((part) => evaluateCondition(part.trim(), state, scene));
  }

  if (condition.startsWith('hasFlag:')) {
    return hasFlag(state, condition.slice('hasFlag:'.length));
  }

  if (condition.startsWith('notFlag:')) {
    return !hasFlag(state, condition.slice('notFlag:'.length));
  }

  if (condition.startsWith('hasItem:')) {
    const itemId = condition.slice('hasItem:'.length);
    return state.inventory.some((item) => item.id === itemId);
  }

  if (condition.startsWith('notItem:')) {
    const itemId = condition.slice('notItem:'.length);
    return state.inventory.every((item) => item.id !== itemId);
  }

  if (condition === 'allObjectsExamined') {
    if (!scene) {
      return false;
    }
    const examined = state.examinedObjects[scene.sceneId] ?? [];
    return scene.objects.every((object) => examined.includes(object.id));
  }

  return false;
}
