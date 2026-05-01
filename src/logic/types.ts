export interface LocalizedText {
  token: string;
  text: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  hoverText?: string;
}

export interface QTERecord {
  sceneId: string;
  action: string;
  success: boolean;
  timePenalty: number;
}

export interface RelationshipMap {
  [characterId: string]: number;
}

export interface GameState {
  currentSceneId: string;
  flags: string[];
  inventory: InventoryItem[];
  chaosPoints: number;
  suspicionLevel: number;
  timeRemaining: number;
  relationship: RelationshipMap;
  qteHistory: QTERecord[];
  examinedObjects: Record<string, string[]>;
  pendingQteSceneId?: string;
}

export interface GameData {
  initialSceneId: string;
  initialInventory?: InventoryItem[];
  scenes: SceneData[];
  balance: BalanceConfig;
}

export interface BalanceConfig {
  initialTimeRemaining: number;
  sceneTransitionCost: number;
  failedQteTimePenalty: number;
  qteByEpisode: Record<string, QTEBalance>;
}

export interface QTEBalance {
  timeLimit: number;
  optionCount: number;
  hasPunishingEmptyChoice?: boolean;
}

export interface SceneData {
  sceneId: string;
  episode: number;
  title: string;
  background: string;
  initialMusic: string;
  entryTextToken: string;
  entryText: string;
  objects: SceneObject[];
  exits?: SceneExit[];
  qteEvent?: QTEEvent;
}

export interface SceneExit {
  targetSceneId: string;
  text: string;
  condition: string;
}

export interface SceneObject {
  id: string;
  nameToken: string;
  name: string;
  hoverText?: string;
  condition?: string;
  position: HotspotPosition;
  interactions: Interaction[];
}

export interface HotspotPosition {
  x: number;
  y: number;
  radius: number;
  width?: number;
  height?: number;
  labelY?: number;
}

export interface Interaction {
  action: string;
  label: string;
  condition: string;
  textToken: string;
  text: string;
  result: InteractionResult;
  animation?: string;
  soundEvent?: string;
  showInChoices?: boolean;
  choiceScope?: 'global' | 'local' | 'both';
}

export interface InteractionResult {
  addFlag?: string;
  addFlags?: string[];
  setFlag?: string;
  removeFlag?: string;
  autoTrigger?: AutoTrigger;
  addInventory?: InventoryItem | InventoryItem[];
  removeInventory?: string;
  returnToPanorama?: boolean;
  chaosDelta?: number;
  suspicionDelta?: number;
  relationshipDelta?: Record<string, number>;
  timeDelta?: number;
  sceneChange?: string;
  qteSuccess?: boolean;
}

export interface AutoTrigger {
  objectId: string;
  action: string;
  includeTriggerText?: boolean;
}

export interface QTEEvent {
  trigger: 'afterAllObjectsExamined';
  promptToken: string;
  prompt: string;
  timeLimit: number;
  choices: QTEChoice[];
}

export interface QTEChoice {
  action: string;
  textToken: string;
  text: string;
  result: InteractionResult;
  animation?: string;
  soundEvent?: string;
}

export interface Choice {
  id: string;
  label: string;
  objectId?: string;
  action: string;
  kind: 'interaction' | 'exit' | 'qte';
}

export interface AnimationTrigger {
  id: string;
  targetId?: string;
}

export interface TurnResult {
  newState: GameState;
  displayText: LocalizedText;
  choices: Choice[];
  animations: AnimationTrigger[];
  soundEvent?: string;
  sceneChange?: string;
  qteTrigger?: QTEEvent;
}
