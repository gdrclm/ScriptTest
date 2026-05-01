import { ActionResolver } from './ActionResolver';
import { evaluateCondition } from './conditions';
import { SceneRegistry } from './SceneRegistry';
import type { AutoTrigger, Choice, GameData, GameState, Interaction, QTEEvent, SceneData, TurnResult } from './types';

function initialState(data: GameData): GameState {
  return {
    currentSceneId: data.initialSceneId,
    flags: [],
    inventory: data.initialInventory ?? [],
    chaosPoints: 0,
    suspicionLevel: 0,
    timeRemaining: data.balance.initialTimeRemaining,
    relationship: {},
    qteHistory: [],
    examinedObjects: {},
  };
}

export class GameController {
  private state: GameState;
  private readonly registry: SceneRegistry;

  constructor(private readonly data: GameData) {
    this.registry = new SceneRegistry(data.scenes);
    this.state = initialState(data);
  }

  getState(): GameState {
    return this.state;
  }

  getCurrentScene() {
    return this.registry.get(this.state.currentSceneId);
  }

  getInitialTurn(): TurnResult {
    const scene = this.getCurrentScene();
    return {
      newState: this.state,
      displayText: { token: scene.entryTextToken, text: scene.entryText },
      choices: this.buildSceneChoices(this.state),
      animations: [],
    };
  }

  performAction(sceneId: string, objectId: string, action: string): TurnResult {
    const scene = this.registry.get(sceneId);
    const object = scene.objects.find((item) => item.id === objectId && evaluateCondition(item.condition ?? 'always', this.state, scene));
    if (!object) {
      throw new Error(`Object "${objectId}" not found in scene "${sceneId}".`);
    }

    const interaction = object.interactions.find(
      (item) => item.action === action && evaluateCondition(item.condition, this.state, scene),
    );
    if (!interaction) {
      throw new Error(`Action "${action}" not found for object "${objectId}".`);
    }

    let newState = ActionResolver.resolveInteraction(this.state, sceneId, objectId, interaction);
    let displayText = interaction.text;
    const animations = interaction.animation ? [{ id: interaction.animation, targetId: objectId }] : [];
    let soundEvent = interaction.soundEvent;
    let sceneChange = interaction.result.sceneChange;

    if (interaction.result.autoTrigger) {
      const autoTurn = this.resolveAutoTrigger(scene, newState, interaction.result.autoTrigger);
      newState = autoTurn.newState;
      displayText =
        interaction.result.autoTrigger.includeTriggerText === false
          ? autoTurn.interaction.text
          : `${interaction.text}\n\n${autoTurn.interaction.text}`;
      if (autoTurn.interaction.animation) {
        animations.push({ id: autoTurn.interaction.animation, targetId: autoTurn.objectId });
      }
      soundEvent = autoTurn.interaction.soundEvent ?? soundEvent;
      sceneChange = autoTurn.interaction.result.sceneChange ?? sceneChange;
    }

    const qteTrigger = sceneChange ? undefined : this.findQteTrigger(newState, scene);
    this.state = qteTrigger
      ? {
          ...newState,
          flags: [...new Set([...newState.flags, `qte_done:${scene.sceneId}`])],
          pendingQteSceneId: scene.sceneId,
        }
      : newState;

    return {
      newState: this.state,
      displayText: { token: interaction.textToken, text: displayText },
      choices: this.buildSceneChoices(
        this.state,
        sceneChange || interaction.result.returnToPanorama ? undefined : objectId,
      ),
      animations,
      soundEvent,
      sceneChange,
      qteTrigger,
    };
  }

  performChoice(choice: Choice): TurnResult {
    if (choice.kind === 'exit' && choice.objectId) {
      return this.changeScene(choice.objectId);
    }

    if (choice.kind === 'qte') {
      return this.performQte(choice.action);
    }

    if (!choice.objectId) {
      return this.blockedTurn('Не удалось определить объект действия.');
    }

    return this.performAction(this.state.currentSceneId, choice.objectId, choice.action);
  }

  performQte(action: string, timedOut = false): TurnResult {
    const pendingSceneId = this.state.pendingQteSceneId;
    if (!pendingSceneId) {
      return this.blockedTurn('Сейчас нет активного QTE.');
    }

    const scene = this.registry.get(pendingSceneId);
    const qte = scene.qteEvent;
    if (!qte) {
      return this.blockedTurn('Для этой сцены QTE не описано.');
    }

    const fallback = qte.choices[qte.choices.length - 1];
    const choice = qte.choices.find((item) => item.action === action) ?? fallback;
    const newState = ActionResolver.resolveQte(this.state, scene.sceneId, choice, timedOut);
    this.state = newState;

    return {
      newState,
      displayText: {
        token: choice.textToken,
        text: timedOut ? 'Ты замешкался. Корпоративная машина отметила это как инициативу.' : choice.text,
      },
      choices: this.buildSceneChoices(newState),
      animations: choice.animation ? [{ id: choice.animation }] : [],
      soundEvent: choice.soundEvent,
    };
  }

  private changeScene(targetSceneId: string): TurnResult {
    const nextScene = this.registry.get(targetSceneId);
    this.state = {
      ...this.state,
      currentSceneId: targetSceneId,
      timeRemaining: Math.max(0, this.state.timeRemaining - this.data.balance.sceneTransitionCost),
      pendingQteSceneId: undefined,
    };

    return {
      newState: this.state,
      displayText: { token: nextScene.entryTextToken, text: nextScene.entryText },
      choices: this.buildSceneChoices(this.state),
      animations: [{ id: 'scene-fade' }],
      sceneChange: targetSceneId,
      soundEvent: nextScene.initialMusic,
    };
  }

  private findQteTrigger(state: GameState, scene: ReturnType<SceneRegistry['get']>): QTEEvent | undefined {
    if (!scene.qteEvent || state.pendingQteSceneId === scene.sceneId) {
      return undefined;
    }

    const flag = `qte_done:${scene.sceneId}`;
    if (state.flags.includes(flag)) {
      return undefined;
    }

    if (scene.qteEvent.trigger === 'afterAllObjectsExamined' && evaluateCondition('allObjectsExamined', state, scene)) {
      return scene.qteEvent;
    }

    return undefined;
  }

  private resolveAutoTrigger(
    scene: SceneData,
    state: GameState,
    trigger: AutoTrigger,
  ): { newState: GameState; interaction: Interaction; objectId: string } {
    const object = scene.objects.find(
      (item) => item.id === trigger.objectId && evaluateCondition(item.condition ?? 'always', state, scene),
    );
    if (!object) {
      throw new Error(`Auto-trigger object "${trigger.objectId}" not found in scene "${scene.sceneId}".`);
    }

    const interaction = object.interactions.find(
      (item) => item.action === trigger.action && evaluateCondition(item.condition, state, scene),
    );
    if (!interaction) {
      throw new Error(`Auto-trigger action "${trigger.action}" not found for object "${trigger.objectId}".`);
    }

    return {
      newState: ActionResolver.resolveInteraction(state, scene.sceneId, object.id, interaction),
      interaction,
      objectId: object.id,
    };
  }

  private buildSceneChoices(state: GameState, preferredObjectId?: string): Choice[] {
    const scene = this.registry.get(state.currentSceneId);
    const objectChoices = scene.objects.flatMap((object) =>
      !evaluateCondition(object.condition ?? 'always', state, scene)
        ? []
        : object.interactions
        .filter((interaction) => evaluateCondition(interaction.condition, state, scene))
        .filter((interaction) => interaction.showInChoices !== false)
        .filter((interaction) => {
          const scope = interaction.choiceScope ?? 'both';
          return preferredObjectId ? scope !== 'global' : scope !== 'local';
        })
        .filter(() => !preferredObjectId || object.id === preferredObjectId)
        .map((interaction) => ({
          id: `${object.id}:${interaction.action}`,
          label: preferredObjectId === object.id ? interaction.label : `${object.name}: ${interaction.label}`,
          objectId: object.id,
          action: interaction.action,
          kind: 'interaction' as const,
        })),
    );

    const exits =
      scene.exits
        ?.filter((exit) => evaluateCondition(exit.condition, state, scene))
        .map((exit) => ({
          id: `exit:${exit.targetSceneId}`,
          label: exit.text,
          objectId: exit.targetSceneId,
          action: 'go',
          kind: 'exit' as const,
        })) ?? [];

    return [...objectChoices, ...exits];
  }

  private blockedTurn(text: string): TurnResult {
    return {
      newState: this.state,
      displayText: { token: 'BLOCKED', text },
      choices: this.buildSceneChoices(this.state),
      animations: [],
    };
  }
}
