import balance from './balance.json';
import episode1 from './scenes/episode1.json';
import episode2 from './scenes/episode2.json';
import episode3 from './scenes/episode3.json';
import type { BalanceConfig, GameData, SceneData } from '../logic/types';

export const gameData: GameData = {
  initialSceneId: '1_1_intern_room',
  initialInventory: [{ id: 'intern_journal', name: 'Журнал стажёра' }],
  balance: balance as BalanceConfig,
  scenes: [episode1, episode2, episode3] as SceneData[],
};
