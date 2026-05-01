import { describe, expect, it } from 'vitest';
import { gameData } from '../data/gameData';
import { GameController } from './GameController';

describe('GameController', () => {
  it('applies interaction effects without depending on presentation code', () => {
    const controller = new GameController(gameData);

    controller.performAction('1_1_intern_room', 'wardrobe', 'examine');
    const result = controller.performAction('1_1_intern_room', 'wardrobe', 'take_uniform');

    expect(result.newState.flags).toContain('hasUniform');
    expect(result.newState.chaosPoints).toBe(0);
    expect(result.newState.inventory).toContainEqual({
      id: 'intern_uniform',
      name: 'Форма стажёра',
      hoverText: 'Причиняю добро с 9 до 18.',
    });
  });

  it('shows leave choice only after clicking the door when room requirements are done', () => {
    const controller = new GameController(gameData);

    const lockedDoor = controller.performAction('1_1_intern_room', 'exit_door', 'examine');
    expect(lockedDoor.displayText.text).toBe('Дверь закрыта. Нужен ключ из тумбы.');

    controller.performAction('1_1_intern_room', 'mirror', 'examine');
    controller.performAction('1_1_intern_room', 'mirror', 'wipe_spot');
    controller.performAction('1_1_intern_room', 'nightstand', 'examine');
    controller.performAction('1_1_intern_room', 'nightstand', 'enter_0918');
    controller.performAction('1_1_intern_room', 'nightstand', 'open_drawer');

    const door = controller.performAction('1_1_intern_room', 'exit_door', 'examine');

    expect(door.choices).toContainEqual(
      expect.objectContaining({ id: 'exit_door:leave', label: 'Выйти', kind: 'interaction' }),
    );
  });

  it('implements the mirror subscene from window1v2.md', () => {
    const controller = new GameController(gameData);

    const mirror = controller.performAction('1_1_intern_room', 'mirror', 'examine');
    expect(mirror.displayText.text).toContain('Крупный план мутного зеркала.');
    expect(mirror.choices).toContainEqual(expect.objectContaining({ label: 'Стереть пятно' }));

    const code = controller.performAction('1_1_intern_room', 'mirror', 'wipe_spot');
    const pocket = controller.performAction('1_1_intern_room', 'mirror', 'evil_face');

    expect(code.newState.flags).toContain('code_0918');
    expect(pocket.newState.flags).toContain('pajamaPocketUnlocked');
    expect(pocket.newState.chaosPoints).toBe(1);
  });

  it('locks mirror alternatives after one face choice', () => {
    const controller = new GameController(gameData);

    controller.performAction('1_1_intern_room', 'mirror', 'examine');
    const result = controller.performAction('1_1_intern_room', 'mirror', 'normal_face');

    expect(result.choices).not.toContainEqual(expect.objectContaining({ action: 'evil_face' }));
  });

  it('shows object-local choice labels exactly like the interaction tree', () => {
    const controller = new GameController(gameData);

    const mirror = controller.performAction('1_1_intern_room', 'mirror', 'examine');
    const bed = controller.performAction('1_1_intern_room', 'bed', 'examine');
    const alarm = controller.performAction('1_1_intern_room', 'alarm', 'examine');

    expect(mirror.choices).toContainEqual(expect.objectContaining({ label: 'Сделать злодейское лицо' }));
    expect(mirror.choices).toContainEqual(expect.objectContaining({ label: 'Обычное лицо' }));
    expect(bed.choices).toContainEqual(expect.objectContaining({ label: 'Потянуть уголок карточки' }));
    expect(alarm.choices).toContainEqual(expect.objectContaining({ label: 'Установить стрелки на 9:18' }));
  });

  it('does not repeat room-wide examine choice after selecting an object', () => {
    const controller = new GameController(gameData);

    expect(controller.getInitialTurn().choices).toContainEqual(expect.objectContaining({ label: 'Комната: Осмотреть комнату' }));

    const result = controller.performAction('1_1_intern_room', 'mirror', 'examine');

    expect(result.choices).not.toContainEqual(expect.objectContaining({ label: 'Комната: Осмотреть комнату' }));
  });

  it('opens the nightstand with code 0918 and gives the key and pass', () => {
    const controller = new GameController(gameData);

    controller.performAction('1_1_intern_room', 'alarm', 'examine');
    controller.performAction('1_1_intern_room', 'alarm', 'set_hands');
    controller.performAction('1_1_intern_room', 'alarm', 'press_button');
    controller.performAction('1_1_intern_room', 'nightstand', 'examine');
    controller.performAction('1_1_intern_room', 'nightstand', 'enter_0918');
    const drawer = controller.performAction('1_1_intern_room', 'nightstand', 'open_drawer');

    expect(drawer.newState.inventory).toContainEqual(
      expect.objectContaining({ id: 'door_key', name: 'Ключ от двери' }),
    );
    expect(drawer.newState.inventory).toContainEqual(
      expect.objectContaining({ id: 'intern_pass', name: 'Пропуск стажёра' }),
    );
  });

  it('implements the HR desk signing flow from window2.md', () => {
    const controller = new GameController(gameData);

    expect(() => controller.performAction('2_1_archive', 'boss_jabs', 'examine')).toThrow();

    controller.performAction('1_1_intern_room', 'mirror', 'examine');
    controller.performAction('1_1_intern_room', 'mirror', 'wipe_spot');
    controller.performAction('1_1_intern_room', 'nightstand', 'examine');
    controller.performAction('1_1_intern_room', 'nightstand', 'enter_0918');
    controller.performAction('1_1_intern_room', 'nightstand', 'open_drawer');
    controller.performAction('1_1_intern_room', 'exit_door', 'examine');
    controller.performAction('1_1_intern_room', 'exit_door', 'leave');

    const desk = controller.performAction('2_1_archive', 'hr_desk', 'examine');
    expect(desk.displayText.text).toBe('Заявление на трудостройство. Мелкий шрифт внизу.');
    expect(desk.choices).toContainEqual(expect.objectContaining({ label: 'Подписать не глядя' }));
    expect(desk.choices).toContainEqual(expect.objectContaining({ label: 'Вчитаться в мелкий шрифт' }));

    const read = controller.performAction('2_1_archive', 'hr_desk', 'read_small_print');
    expect(read.choices).toContainEqual(expect.objectContaining({ label: 'Подписать' }));

    const signed = controller.performAction('2_1_archive', 'hr_desk', 'sign_after_reading');

    expect(signed.displayText.text).toContain('Подпись похожа на крик. Документ доволен.');
    expect(signed.displayText.text).toContain('Жабс: “Герой! Холл! Пончик! Бросай!”');
    expect(signed.newState.currentSceneId).toBe('3_1_rooftop');
    expect(signed.newState.flags).toContain('hasDonut');
    expect(signed.newState.inventory).toContainEqual({
      id: 'stale_donut',
      name: 'Черствый пончик “Задержка-3000”',
      hoverText: 'Бросается. Черствее тебя.',
    });
  });

  it('lets the broken HR chair accidentally sign the contract from window2.md', () => {
    const controller = new GameController(gameData);

    const chair = controller.performAction('2_1_archive', 'chair', 'examine');
    expect(chair.displayText.text).toBe('Стул стажёра. Одна ножка короче.');

    const signedByChair = controller.performAction('2_1_archive', 'chair', 'sit');

    expect(signedByChair.displayText.text).toContain('Документ принимает это за подпись.');
    expect(signedByChair.displayText.text).toContain('Жабс: “Герой! Холл! Пончик! Бросай!”');
    expect(signedByChair.newState.flags).toContain('signedContract');
    expect(signedByChair.newState.currentSceneId).toBe('3_1_rooftop');
  });
});
