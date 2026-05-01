import type { SceneData } from './types';

export class SceneRegistry {
  private readonly scenes = new Map<string, SceneData>();

  constructor(sceneData: SceneData[]) {
    sceneData.forEach((scene) => this.scenes.set(scene.sceneId, scene));
  }

  get(sceneId: string): SceneData {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      throw new Error(`Scene "${sceneId}" is not registered.`);
    }
    return scene;
  }

  all(): SceneData[] {
    return [...this.scenes.values()];
  }
}
