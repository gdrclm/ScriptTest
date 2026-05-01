import { useEffect, useRef, useState } from 'react';
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import type { SceneData } from '../logic/types';
import internRoomPanorama from '../data/scenes/1экран-панорама.png';
import hrPanorama from '../data/scenes/2экран-панорама.png';
import internReflection from '../data/scenes/intern-reflection.png';

interface PanoramaCanvasProps {
  scene: SceneData;
  visibleObjectIds: string[];
  showMirrorCharacter: boolean;
  onHotspot: (objectId: string) => void;
}

const backgroundAssets: Record<string, string> = {
  intern_room_panorama: internRoomPanorama,
  hr_office_panorama: hrPanorama,
};

const CAMERA_ZOOM = 1.75;
const SEAM_OVERLAP_PX = 140;
const SEAM_BLEND_STEPS = 12;
const INITIAL_FOCUS = {
  x: 900,
  y: 455,
};
const MIRROR_REFLECTION_PLACEMENT = {
  x: 938,
  y: 304,
  width: 122,
  height: 286,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

interface PolygonFocusShape {
  kind: 'polygon';
  points: number[];
}

interface EllipseFocusShape {
  kind: 'ellipse';
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
}

interface RoundRectFocusShape {
  kind: 'roundRect';
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

interface LineFocusShape {
  kind: 'line';
  points: number[];
}

type FocusShape = PolygonFocusShape | EllipseFocusShape | RoundRectFocusShape | LineFocusShape;

interface PanoramaControls {
  objectGroups: Map<string, Container[]>;
  mirrorReflections: Container[];
}

const objectFocusShapes: Record<string, FocusShape[]> = {
  mirror: [
    {
      kind: 'polygon',
      points: [963, 313, 1040, 312, 1052, 552, 1040, 565, 948, 565, 939, 553, 944, 328],
    },
    { kind: 'polygon', points: [978, 570, 1030, 570, 1042, 580, 964, 581] },
  ],
  wardrobe: [
    {
      kind: 'polygon',
      points: [1092, 286, 1288, 267, 1300, 649, 1278, 672, 1080, 687, 1084, 306],
    },
    { kind: 'line', points: [1190, 294, 1191, 655] },
  ],
  carafe: [
    { kind: 'roundRect', x: 1254, y: 573, width: 82, height: 42, radius: 16 },
    { kind: 'ellipse', x: 1294, y: 655, radiusX: 62, radiusY: 80 },
    {
      kind: 'polygon',
      points: [1346, 622, 1367, 625, 1372, 679, 1351, 701, 1343, 688, 1358, 671, 1355, 636, 1343, 635],
    },
  ],
  poster: [
    {
      kind: 'polygon',
      points: [466, 223, 657, 231, 657, 489, 462, 491],
    },
  ],
  bed: [
    {
      kind: 'polygon',
      points: [382, 574, 536, 500, 784, 518, 842, 586, 724, 704, 413, 678],
    },
    {
      kind: 'line',
      points: [384, 573, 382, 684, 414, 678],
    },
    {
      kind: 'line',
      points: [842, 586, 848, 655, 724, 704],
    },
  ],
  nightstand: [
    {
      kind: 'polygon',
      points: [934, 575, 1068, 568, 1082, 704, 916, 708],
    },
    {
      kind: 'polygon',
      points: [948, 613, 1058, 610, 1064, 682, 941, 686],
    },
  ],
  window: [
    {
      kind: 'polygon',
      points: [736, 361, 928, 350, 929, 433, 735, 444],
    },
  ],
  alarm: [
    { kind: 'ellipse', x: 1005, y: 558, radiusX: 27, radiusY: 16 },
    { kind: 'polygon', points: [982, 548, 991, 539, 1019, 539, 1030, 548, 1025, 565, 986, 566] },
  ],
  exit_door: [
    {
      kind: 'polygon',
      points: [1588, 300, 1738, 294, 1745, 683, 1584, 689],
    },
  ],
  hr_desk: [
    { kind: 'polygon', points: [34, 557, 560, 510, 690, 777, 134, 830] },
    { kind: 'polygon', points: [285, 587, 497, 584, 540, 738, 254, 747] },
  ],
  paper_drone: [
    { kind: 'ellipse', x: 588, y: 289, radiusX: 78, radiusY: 42 },
    { kind: 'polygon', points: [582, 314, 625, 336, 615, 409, 555, 389] },
  ],
  employee_poster: [
    { kind: 'polygon', points: [1323, 212, 1517, 203, 1517, 455, 1322, 467] },
  ],
  culture_board: [
    { kind: 'polygon', points: [150, 222, 297, 242, 304, 444, 151, 449] },
  ],
  clock: [
    { kind: 'ellipse', x: 1129, y: 398, radiusX: 32, radiusY: 30 },
  ],
  chair: [
    { kind: 'polygon', points: [779, 477, 845, 473, 852, 637, 779, 642] },
  ],
  trash_bin: [
    { kind: 'ellipse', x: 73, y: 776, radiusX: 78, radiusY: 46 },
    { kind: 'polygon', points: [4, 777, 139, 776, 122, 841, 24, 844] },
  ],
  coffee_machine: [
    { kind: 'polygon', points: [0, 271, 54, 270, 64, 510, 0, 523] },
  ],
  boss_jabs: [
    { kind: 'polygon', points: [1367, 279, 1487, 276, 1502, 440, 1351, 450] },
    { kind: 'ellipse', x: 1428, y: 378, radiusX: 74, radiusY: 62 },
  ],
};

function scalePoints(points: number[], scale: number) {
  return points.map((point) => point * scale);
}

function drawFocusShape(graphics: Graphics, shape: FocusShape, scale: number, stroke: object, fill?: object) {
  switch (shape.kind) {
    case 'polygon': {
      const points = scalePoints(shape.points, scale);
      if (fill) {
        graphics.poly(points).fill(fill);
      }
      graphics.poly(points).stroke(stroke);
      break;
    }
    case 'ellipse': {
      if (fill) {
        graphics.ellipse(shape.x * scale, shape.y * scale, shape.radiusX * scale, shape.radiusY * scale).fill(fill);
      }
      graphics.ellipse(shape.x * scale, shape.y * scale, shape.radiusX * scale, shape.radiusY * scale).stroke(stroke);
      break;
    }
    case 'roundRect': {
      if (fill) {
        graphics
          .roundRect(shape.x * scale, shape.y * scale, shape.width * scale, shape.height * scale, shape.radius * scale)
          .fill(fill);
      }
      graphics
        .roundRect(shape.x * scale, shape.y * scale, shape.width * scale, shape.height * scale, shape.radius * scale)
        .stroke(stroke);
      break;
    }
    case 'line': {
      const points = scalePoints(shape.points, scale);
      graphics.poly(points).stroke(stroke);
      break;
    }
  }
}

function drawObjectFocus(graphics: Graphics, objectId: string, scale: number, isHover: boolean) {
  graphics.clear();

  if (!isHover) {
    return;
  }

  const glow = { width: 7, color: 0x50e8ff, alpha: 0.18 };
  const line = { width: 2.5, color: 0x74f0ff, alpha: 0.95 };
  const fill = { color: 0x58eaff, alpha: 0.055 };

  const shapes = objectFocusShapes[objectId];
  if (!shapes) {
    return;
  }

  shapes.forEach((shape) => drawFocusShape(graphics, shape, scale, glow, shape.kind === 'line' ? undefined : fill));
  shapes.forEach((shape) => drawFocusShape(graphics, shape, scale, line));
}

async function drawScene(
  stage: Container,
  scene: SceneData,
  width: number,
  height: number,
  onHotspot: (id: string) => void,
): Promise<PanoramaControls> {
  const world = new Container();
  const objectGroups = new Map<string, Container[]>();
  const mirrorReflections: Container[] = [];
  const asset = backgroundAssets[scene.background];
  const texture = asset ? await Assets.load(asset) : undefined;
  const baseScale = texture ? height / texture.height : 1;
  const scale = baseScale * CAMERA_ZOOM;
  const panoramaWidth = texture ? texture.width * scale : Math.max(width * 2.4, 1500);
  const panoramaHeight = texture ? texture.height * scale : height * CAMERA_ZOOM;
  const seamOverlap = texture ? Math.min(SEAM_OVERLAP_PX * scale, panoramaWidth * 0.12) : 0;
  const wrapWidth = panoramaWidth - seamOverlap;
  const wraps = [-1, 0, 1];
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let worldStartX = 0;
  let worldStartY = 0;
  let movedDuringDrag = false;
  const minWorldY = Math.min(0, height - panoramaHeight);
  const maxWorldY = 0;

  world.x = width / 2 - INITIAL_FOCUS.x * scale;
  world.y = clamp(height / 2 - INITIAL_FOCUS.y * scale, minWorldY, maxWorldY);

  if (texture) {
    const seamStepWidth = seamOverlap / SEAM_BLEND_STEPS;

    wraps.forEach((wrapIndex) => {
      const copyX = wrapIndex * wrapWidth;
      const background = new Sprite(texture);
      const mainMask = new Graphics();
      background.scale.set(scale);
      background.x = copyX;
      mainMask.rect(copyX + seamOverlap, 0, panoramaWidth - seamOverlap, panoramaHeight).fill(0xffffff);
      background.mask = mainMask;
      world.addChild(background, mainMask);
    });

    wraps.forEach((wrapIndex) => {
      const copyX = wrapIndex * wrapWidth;
      for (let step = 0; step < SEAM_BLEND_STEPS; step += 1) {
        const maskX = copyX + step * seamStepWidth;
        const overlay = new Sprite(texture);
        const mask = new Graphics();
        overlay.scale.set(scale);
        overlay.x = copyX;
        overlay.alpha = (step + 1) / SEAM_BLEND_STEPS;
        mask.rect(maskX, 0, seamStepWidth + 1, panoramaHeight).fill(0xffffff);
        overlay.mask = mask;
        world.addChild(overlay, mask);
      }
    });
  } else {
    wraps.forEach((wrapIndex) => {
      const background = new Graphics();
      background.x = wrapIndex * wrapWidth;
      background.rect(0, 0, panoramaWidth, height).fill(0x151922);
      world.addChild(background);
    });
  }

  if (scene.sceneId === '1_1_intern_room') {
    const reflectionTexture = await Assets.load(internReflection);
    wraps.forEach((wrapIndex) => {
      const reflectionGroup = new Container();
      const reflection = new Sprite(reflectionTexture);
      const mask = new Graphics();
      reflection.x = wrapIndex * wrapWidth + MIRROR_REFLECTION_PLACEMENT.x * scale;
      reflection.y = MIRROR_REFLECTION_PLACEMENT.y * scale;
      reflection.scale.set(
        (MIRROR_REFLECTION_PLACEMENT.width * scale) / reflectionTexture.width,
        (MIRROR_REFLECTION_PLACEMENT.height * scale) / reflectionTexture.height,
      );
      mask
        .roundRect(
          wrapIndex * wrapWidth + 942 * scale,
          310 * scale,
          112 * scale,
          276 * scale,
          18 * scale,
        )
        .fill(0xffffff);
      reflection.mask = mask;
      reflectionGroup.visible = false;
      reflectionGroup.addChild(reflection, mask);
      mirrorReflections.push(reflectionGroup);
      world.addChild(reflectionGroup);
    });
  }

  function createHotspot(object: SceneData['objects'][number], wrapIndex: number) {
    const group = new Container();
    const marker = new Graphics();
    const focus = new Graphics();
    const hitWidth = (object.position.width ?? object.position.radius * 2) * scale;
    const hitHeight = (object.position.height ?? object.position.radius * 2) * scale;
    const markerX = object.position.x * scale + wrapIndex * wrapWidth;
    const markerY = object.position.y * scale;

    marker.rect(-hitWidth / 2, -hitHeight / 2, hitWidth, hitHeight).fill({ color: 0xffffff, alpha: 0.001 });
    marker.x = markerX;
    marker.y = markerY;
    marker.eventMode = 'static';
    marker.cursor = 'pointer';

    focus.x = wrapIndex * wrapWidth;
    focus.y = 0;
    drawObjectFocus(focus, object.id, scale, false);

    marker.on('pointertap', () => {
      if (!movedDuringDrag) {
        onHotspot(object.id);
      }
    });
    marker.on('pointerover', () => {
      drawObjectFocus(focus, object.id, scale, true);
    });
    marker.on('pointerout', () => {
      drawObjectFocus(focus, object.id, scale, false);
    });

    const labelGroup = new Container();
    labelGroup.x = markerX;
    labelGroup.y = (object.position.labelY ?? object.position.y - object.position.radius - 52) * scale;

    const label = new Text({
      text: object.name.toUpperCase(),
      style: {
        fill: 0xbff8ff,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: Math.max(12, 18 * scale),
        fontWeight: '700',
      },
    });
    label.anchor.set(0.5, 0.5);

    const plate = new Graphics();
    const plateWidth = label.width + 28;
    const plateHeight = Math.max(30, label.height + 13);
    plate
      .roundRect(-plateWidth / 2, -plateHeight / 2, plateWidth, plateHeight, 8)
      .fill({ color: 0x061019, alpha: 0.78 })
      .stroke({ width: 2, color: 0x69ecff, alpha: 0.92 });
    plate
      .roundRect(-plateWidth / 2 - 4, -plateHeight / 2 - 4, plateWidth + 8, plateHeight + 8, 10)
      .stroke({ width: 1, color: 0x69ecff, alpha: 0.28 });

    const hover = new Text({
      text: object.hoverText ?? '',
      style: {
        fill: 0xf9c85f,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: Math.max(10, 13 * scale),
        fontWeight: '600',
      },
    });
    hover.anchor.set(0.5, 0);
    hover.y = plateHeight / 2 + 5;
    labelGroup.alpha = 0;

    marker.on('pointerover', () => {
      labelGroup.alpha = 1;
      hover.alpha = object.hoverText ? 1 : 0;
    });
    marker.on('pointerout', () => {
      labelGroup.alpha = 0;
      hover.alpha = 0;
    });

    labelGroup.addChild(plate, label, hover);
    group.addChild(focus, marker, labelGroup);
    world.addChild(group);

    const groups = objectGroups.get(object.id) ?? [];
    groups.push(group);
    objectGroups.set(object.id, groups);
  }

  scene.objects.forEach((object) => {
    if (object.position.radius <= 1) {
      return;
    }

    wraps.forEach((wrapIndex) => createHotspot(object, wrapIndex));
  });

  stage.addChild(world);

  const normalizeWorldX = () => {
    if (world.x > 0) {
      world.x -= wrapWidth;
      worldStartX -= wrapWidth;
    }
    if (world.x <= -wrapWidth) {
      world.x += wrapWidth;
      worldStartX += wrapWidth;
    }
  };

  stage.eventMode = 'static';
  stage.hitArea = new Rectangle(0, 0, width, height);
  stage.on('pointerdown', (event) => {
    dragging = true;
    movedDuringDrag = false;
    dragStartX = event.global.x;
    dragStartY = event.global.y;
    worldStartX = world.x;
    worldStartY = world.y;
  });
  stage.on('pointerup', () => {
    dragging = false;
  });
  stage.on('pointerupoutside', () => {
    dragging = false;
  });
  stage.on('pointermove', (event) => {
    if (!dragging) {
      return;
    }
    const deltaX = event.global.x - dragStartX;
    const deltaY = event.global.y - dragStartY;
    movedDuringDrag = movedDuringDrag || Math.hypot(deltaX, deltaY) > 4;
    world.x = worldStartX + deltaX;
    world.y = clamp(worldStartY + deltaY, minWorldY, maxWorldY);
    normalizeWorldX();
  });

  return { objectGroups, mirrorReflections };
}

function applyVisibility(controls: PanoramaControls, visibleObjectIds: string[], showMirrorCharacter: boolean) {
  const visibleSet = new Set(visibleObjectIds);

  controls.objectGroups.forEach((groups, objectId) => {
    groups.forEach((group) => {
      group.visible = visibleSet.has(objectId);
    });
  });

  controls.mirrorReflections.forEach((reflection) => {
    reflection.visible = showMirrorCharacter;
  });
}

export function PanoramaCanvas({ scene, visibleObjectIds, showMirrorCharacter, onHotspot }: PanoramaCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<PanoramaControls | null>(null);
  const visibleObjectIdsRef = useRef(visibleObjectIds);
  const showMirrorCharacterRef = useRef(showMirrorCharacter);
  const [failed, setFailed] = useState(false);
  const visibleObjectIdsKey = visibleObjectIds.join('|');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    let mounted = false;
    const app = new Application();

    async function mount(hostElement: HTMLDivElement) {
      try {
        const width = Math.max(1, hostElement.clientWidth);
        const height = Math.max(1, hostElement.clientHeight);
        await app.init({
          width,
          height,
          antialias: true,
          backgroundAlpha: 0,
          resizeTo: hostElement,
          preference: 'webgl',
        });

        if (cancelled) {
          app.destroy();
          return;
        }

        hostElement.appendChild(app.canvas);
        mounted = true;
        const controls = await drawScene(app.stage, scene, width, height, onHotspot);
        if (cancelled) {
          return;
        }
        controlsRef.current = controls;
        applyVisibility(controls, visibleObjectIdsRef.current, showMirrorCharacterRef.current);
      } catch (error) {
        console.error('Failed to initialize Pixi panorama', error);
        setFailed(true);
        return;
      }
    }

    mount(host);

    return () => {
      cancelled = true;
      controlsRef.current = null;
      if (mounted) {
        app.destroy(true, { children: true });
      }
    };
  }, [onHotspot, scene.sceneId]);

  useEffect(() => {
    visibleObjectIdsRef.current = visibleObjectIds;
    showMirrorCharacterRef.current = showMirrorCharacter;

    if (controlsRef.current) {
      applyVisibility(controlsRef.current, visibleObjectIds, showMirrorCharacter);
    }
  }, [showMirrorCharacter, visibleObjectIdsKey]);

  const fallbackImage = backgroundAssets[scene.background] ?? internRoomPanorama;

  return (
    <div
      ref={hostRef}
      className={`panorama-canvas${failed ? ' panorama-canvas--fallback' : ''}`}
      aria-label={`Панорама: ${scene.title}`}
    >
      <img className="panorama-fallback-image" src={fallbackImage} alt="" />
    </div>
  );
}
