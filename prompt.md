Отлично. Разрабатываю архитектуру, которая позволит уже сейчас запустить первые три серии в браузере на React + PixiJS + TypeScript, а в будущем безболезненно перейти на Unreal или другой движок.

АРХИТЕКТУРА ТЕКСТО-ВИЗУАЛЬНОГО КВЕСТА «ЗЛО ИНКОРПОРЕЙТЕД»
Архитектура делится на три независимых слоя:

Data Layer — статические JSON-файлы с описанием серий, сцен, объектов, диалогов, QTE-событий.

Logic Layer — чистый TypeScript-модуль без зависимостей от React или PixiJS. Здесь живёт вся игровая математика, проверка условий, управление состоянием.

Presentation Layer — React-компоненты для UI (текст, кнопки, инвентарь, HUD) и PixiJS-холст для рендеринга панорам и анимаций.

Главное правило: Logic Layer ничего не знает о том, как его отображают. Он получает команды и возвращает новое состояние. Это позволит позже написать такой же контроллер на Blueprint / C++, просто скормив ему те же JSON.

1. ОБЩАЯ СХЕМА ВЗАИМОДЕЙСТВИЯ
text
JSON-данные (scenes/*.json)
        ↓
Logic Layer (GameController, State)
        ↕
Presentation Layer
   ├── React UI (меню, текст, выборы, инвентарь)
   └── PixiJS Canvas (панорама, персонажи, эффекты)
Поток данных при клике по объекту:

Игрок кликает по точке на PixiJS-сцене или кнопке в React.

Presentation Layer вызывает метод GameController.performAction(action).

GameController изменяет внутреннее состояние (инвентарь, очки, прогресс сцены) и возвращает объект с описанием того, что должно произойти: текст для отображения, новые доступные действия, анимации, звуки.

React и PixiJS одновременно получают это описание и рендерят изменения. Никакого прямого управления DOM или спрайтами из Logic Layer.

2. Logic Layer — чистый TypeScript
Содержит три главных модуля:

Модуль	Назначение
GameController	Точка входа. Хранит ссылки на все остальные модули, принимает внешние команды, возвращает TurnResult.
GameState	Иммутабельный объект состояния всей игры.
ActionResolver	Обрабатывает действие, применяет математику, проверяет условия, обновляет состояние.
Схема класса GameController
typescript
class GameController {
  private state: GameState;
  private registry: SceneRegistry; // загруженные JSON сцен

  constructor(initialData: GameData) { ... }

  public performAction(sceneId: string, objectId: string, action: string): TurnResult {
    const scene = this.registry.get(sceneId);
    const object = scene.objects.find(o => o.id === objectId);
    const interaction = object.interactions.find(i => i.action === action);

    // Применяем эффекты действия
    const newState = ActionResolver.resolve(this.state, interaction);
    this.state = newState;

    // Определяем, какой текст показать и какие новые действия доступны
    return this.buildTurnResult(newState, interaction);
  }

  public getState(): GameState { return this.state; }
}
Интерфейс GameState (ключевые поля для первых трёх серий)
typescript
interface GameState {
  currentSceneId: string;
  flags: Set<string>;               // "signed_contract", "found_list"
  inventory: InventoryItem[];       // предметы
  chaosPoints: number;              // очки хаоса
  suspicionLevel: number;           // шкала подозрения (серия 5)
  timeRemaining: number;            // таймер до заката / до роботизации
  relationship: { [key: string]: number }; // отношения с персонажами
  qteHistory: QTERecord[];          // история QTE для анализа
}
TurnResult — ответ от логики
typescript
interface TurnResult {
  newState: GameState;             // новое состояние для сохранения
  displayText: LocalizedText;      // текст, который нужно показать (ключ локализации)
  choices: Choice[];               // новые кнопки выбора
  animations: AnimationTrigger[];  // что проиграть в PixiJS
  soundEvent?: string;             // ключ звука
  sceneChange?: string;            // если переходим на другую сцену
}
3. Data Layer — JSON-структура сцен
Каждая серия разбита на сцены (панорамы). Для сцены описываются кликабельные объекты, их тексты, возможные действия и эффекты.

Пример: сцена «Главный холл» из Серии 1.

json
{
  "sceneId": "1_3_hall",
  "background": "hall_panorama_360.jpg",
  "initialMusic": "tense_muzak",
  "objects": [
    {
      "id": "fountain",
      "nameToken": "FOUNTAIN_LABEL",
      "position": { "x": 200, "y": 300, "radius": 50 },
      "interactions": [
        {
          "action": "examine",
          "condition": "always",
          "textToken": "FOUNTAIN_DESC",
          "result": { "addFlag": "fountain_examined" }
        },
        {
          "action": "touch_smoke",
          "condition": "hasFlag:fountain_examined",
          "textToken": "SMOKE_REACTION",
          "result": { "chaosDelta": 1 }
        }
      ]
    },
    {
      "id": "aquarium",
      "nameToken": "AQUARIUM_LABEL",
      "position": { "x": 800, "y": 250, "radius": 80 },
      "interactions": [
        {
          "action": "examine",
          "condition": "always",
          "textToken": "DOLORES_DESC",
          "result": {}
        }
      ]
    }
  ],
  "qteEvent": {
    "trigger": "afterAllObjectsExamined",
    "promptToken": "BOSS_YELL_PROMPT",
    "timeLimit": 3.0,
    "choices": [
      {
        "action": "throw_hero",
        "textToken": "THROW_HERO",
        "result": { "setFlag": "hero_hit" }
      },
      {
        "action": "throw_shark",
        "textToken": "THROW_SHARK",
        "result": { "setFlag": "shark_sleeps" }
      },
      {
        "action": "drop",
        "textToken": "DROP_DONUT",
        "result": {}
      }
    ]
  }
}
Для Серии 2 и 3 структура идентична, меняются только объекты и QTE-условия. Это позволяет легко добавлять новые сцены, не трогая код.

4. Математические модели
Очки хаоса — основная валюта.
Формула начисления:
delta = baseValue * (1 + bonusMultiplier)
где bonusMultiplier зависит от отношения персонажа или от того, насколько красиво пройдена QTE. Очки не опускаются ниже 0.

Шкала подозрения (используется в серии 5, но механика готова заранее):
новое_подозрение = текущее + baseIncrease * (1 - trustFactor)
trustFactor растет, если выбираются «правильные» реплики.

Таймер обратного отсчёта (до роботизации) — общий для игры, уменьшается при каждом переходе между сценами и при неудачных QTE. Если достигает нуля — альтернативная концовка.

Баланс QTE — сложность растет:

Серия 1: время выбора 3 сек, 3 варианта.

Серия 2: время 2.5 сек, 4 варианта.

Серия 3: время 2 сек, 4 варианта + один «пустой» выбор, который ничего не делает и наказывает.

Все эти параметры вынесены в конфигурационный файл balance.json, чтобы их можно было тюнинговать без правки кода.

5. Point-and-Click и 360-панорама в PixiJS
Панорамное изображение (например, hall_panorama_360.jpg) — это обычный спрайт, но с возможностью горизонтального скролла мышью или тачем. Реализация:

PixiJS-контейнер PanoramaLayer создаёт дочерний спрайт с шириной в 2–3 раза больше экрана.

При движении мыши с зажатой кнопкой смещается x спрайта в пределах [-maxOffset, 0].

Все интерактивные объекты (Hotspot) позиционируются в координатах панорамы, а не экрана. При перемещении они автоматически сдвигаются вместе с фоном.

Hotspot — это прозрачная окружность (или rectangle) с хуком на pointertap. При наведении подсвечивается, меняет курсор.

Когда игрок кликает по Hotspot, PixiJS вызывает коллбек, который передаёт objectId и action (по умолчанию "examine") в React-обработчик, а тот дёргает GameController.performAction(...). Результат отображается в React-компоненте диалогового окна.

6. QTE-система
QTE запускается, когда GameController возвращает TurnResult с флагом qteTrigger. React отображает специальный компонент QTEModal, который:

Показывает таймер (обратный отсчёт).

Выводит варианты выбора (обычно 2–4 кнопки с короткими текстами).

Принимает ввод с клавиатуры (1,2,3,4) или клик/тап.

По истечении времени или клику отправляет выбранное действие в GameController.

GameController сразу возвращает новый TurnResult с текстом последствий.

PixiJS в этот момент может проигрывать анимацию (например, вспышку героя), но это уже детали реализации. QTE синхронизируется через общее состояние, без прямого управления из Logic Layer.

7. Интеграция с React
React-приложение включает:

GameScreen — главный контейнер, внутри которого находятся:

PanoramaCanvas (PixiJS, монтируется через useRef + useEffect)

HUD — инвентарь, очки хаоса, таймер (чистые React-компоненты)

DialogueBox — отображает текст из TurnResult.displayText

ChoicePanel — кнопки выбора из TurnResult.choices

QTEModal — появляется поверх всего

Всё взаимодействие между компонентами идёт через единый React-контекст, который хранит текущий GameState и функцию dispatchAction(action). Это делает UI предсказуемым и тестируемым.

8. Как архитектура покрывает первые три серии
Серия	Сцены (кол-во)	Математика	QTE	Особые механики
1. Пончик в акулу	5	Очки хаоса (простое начисление)	Первая QTE в холле	Базовый инвентарь, флаги
2. Монолог в шкафу	4	Очки хаоса, бонус за правильный слоган	Мини-игра с выбором слогана (не на время)	Пароль, доступ к Архиву
3. Архивный червь	4	Использование очков хаоса для покупки подсказок	Нет QTE, но есть ввод пароля	Поиск по ключевым словам, печать улики
Все эти особенности полностью описываются в JSON-сценариях без изменения кода Logic Layer. В будущем туда же лягут более сложные механики вроде диалоговой дуэли из 7-й серии.

Заключение
Вы получаете архитектуру, которая позволяет:

Начать разработку немедленно на React + PixiJS с TypeScript.

Сохранить весь сюжетный контент и баланс в виде независимых JSON-файлов.

Перейти на Unreal на втором этапе, просто переписав визуальную часть и портировав GameController на C++, не трогая сценарий.

Все ключевые точки расширения (QTE, панорамы, инвентарь) уже заложены в фундамент. Первые три серии можно реализовать по этой архитектуре без технического долга.