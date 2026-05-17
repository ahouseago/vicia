import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
} from "pixi.js";
import { Bug } from "./components/bug";
import { Projectile } from "./components/projectile";
import { lerp } from "./utils/lerp";
import { isColliding } from "./utils/collision";

(async () => {
  // Create a new application
  const app = new Application();
  const appElement = document.getElementById("app");
  const pixiContainer = document.getElementById("pixi-container");
  const fullscreenButton = document.getElementById("fullscreen-button");

  if (!appElement || !pixiContainer) {
    throw new Error("Missing app container elements");
  }

  const getFullscreenElement = () =>
    document.fullscreenElement ??
    (document as Document & { webkitFullscreenElement?: Element })
      .webkitFullscreenElement ??
    null;

  const setViewportHeight = () => {
    const viewportHeight = getFullscreenElement()
      ? window.innerHeight
      : (window.visualViewport?.height ?? window.innerHeight);
    appElement.style.setProperty("--app-height", `${viewportHeight}px`);
  };
  let viewportRefreshTimeouts: number[] = [];
  let scheduleViewportRefresh = () => {
    setViewportHeight();
  };

  const syncFullscreenButton = () => {
    if (!fullscreenButton) {
      return;
    }

    const fullscreenElement = getFullscreenElement();
    fullscreenButton.textContent = fullscreenElement
      ? "Exit Fullscreen"
      : "Fullscreen";
  };

  const toggleFullscreen = async () => {
    const fullscreenDoc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const fullscreenTarget = appElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    if (document.fullscreenElement || fullscreenDoc.webkitFullscreenElement) {
      await (document.exitFullscreen?.() ??
        fullscreenDoc.webkitExitFullscreen?.());
      return;
    }

    await (fullscreenTarget.requestFullscreen?.() ??
      fullscreenTarget.webkitRequestFullscreen?.());
  };

  setViewportHeight();
  syncFullscreenButton();
  fullscreenButton?.addEventListener("click", () => {
    void toggleFullscreen();
  });
  document.addEventListener("fullscreenchange", () => {
    syncFullscreenButton();
    scheduleViewportRefresh();
  });
  document.addEventListener("webkitfullscreenchange", (() => {
    syncFullscreenButton();
    scheduleViewportRefresh();
  }) as EventListener);

  // Initialize the asset loader with the base path for assets
  await Assets.init({ basePath: import.meta.env.BASE_URL });

  // Initialize the application
  await app.init({ background: "#395f3f", resizeTo: pixiContainer });

  // Append the application canvas to the document body
  pixiContainer.appendChild(app.canvas);

  const rockTexture = await Assets.load("assets/rock.png");
  const rockContainer = new Container();
  app.stage.addChild(rockContainer);

  const bugTexture = await Assets.load("assets/bug.svg");
  const bugContainer = new Container();
  app.stage.addChild(bugContainer);
  const bugs: Bug[] = [];
  const coarsePointerQuery = window.matchMedia("(any-pointer: coarse)");
  let actorScaleMultiplier = 1;
  let playerBaseScale = 0.25;
  let touchPadRadius = 44;
  let touchKnobRadius = 24;
  let touchMaxRadius = 70;
  let touchDeadzone = 10;
  let touchFollowRadius = 90;

  const updateResponsiveMetrics = () => {
    const minDimension = Math.min(app.screen.width, app.screen.height);
    const coarse = coarsePointerQuery.matches;
    const nextActorScaleMultiplier = coarse
      ? lerp(0.62, 0.88, Math.min(1, minDimension / 700))
      : 1;
    const scaleRatio = nextActorScaleMultiplier / actorScaleMultiplier;

    actorScaleMultiplier = nextActorScaleMultiplier;
    playerBaseScale = coarse
      ? lerp(0.15, 0.21, Math.min(1, minDimension / 700))
      : 0.25;
    touchPadRadius = coarse
      ? lerp(34, 44, Math.min(1, minDimension / 700))
      : 44;
    touchKnobRadius = touchPadRadius * 0.55;
    touchMaxRadius = touchPadRadius * 1.6;
    touchDeadzone = touchPadRadius * 0.22;
    touchFollowRadius = touchPadRadius * 2;
    player.scale.set(playerBaseScale);
    scoreText.style.fontSize = coarse
      ? lerp(26, 40, Math.min(1, app.screen.width / 700))
      : 48;
    scoreContainer.position.set(coarse ? 14 : 20, coarse ? 12 : 20);

    for (const bug of bugs) {
      bug.scale.set(bug.scale.x * scaleRatio, bug.scale.y * scaleRatio);
    }
    for (const rock of rocks) {
      rock.scale.set(rock.scale.x * scaleRatio, rock.scale.y * scaleRatio);
    }
  };

  const newBug = () => {
    const bug = new Bug(bugTexture, {
      maxSpeed: 1,
      acceleration: 0.4,
      size: Math.random() * 9 + 1,
    });
    const angle = Math.random() * Math.PI * 2;
    bug.position.set(
      app.screen.width / 2 + Math.cos(angle) * (app.screen.width / 2 + 100),
      app.screen.height / 2 + Math.sin(angle) * (app.screen.height / 2 + 100),
    );
    bug.scale.set(
      bug.scale.x * actorScaleMultiplier,
      bug.scale.y * actorScaleMultiplier,
    );
    bugContainer.addChild(bug);
    bugs.push(bug);
  };

  for (let i = 0; i < 5; i++) {
    newBug();
  }

  const playerTexture = await Assets.load("assets/character.png");
  const player = new Sprite(playerTexture);
  player.anchor.set(0.5);
  player.position.set(app.screen.width / 2, app.screen.height / 2);
  app.stage.addChild(player);

  app.stage.eventMode = "static";
  app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);

  const shootPointerDownPositions = new Map<number, { x: number; y: number }>();
  let aimPointerDownPosition: { x: number; y: number } | null = null;
  let activeAimPointerId: number | null = null;
  let rotateCooldown = 0;

  const touchMoveHitArea = new Rectangle(
    16,
    Math.max(16, app.screen.height - 220),
    Math.min(220, app.screen.width * 0.42),
    Math.min(220, app.screen.height * 0.34),
  );

  const updateTouchMoveHitArea = () => {
    const margin = coarsePointerQuery.matches ? 16 : 24;
    const desiredWidth = coarsePointerQuery.matches
      ? Math.min(220, app.screen.width * 0.42)
      : Math.min(260, app.screen.width * 0.3);
    const desiredHeight = coarsePointerQuery.matches
      ? Math.min(220, app.screen.height * 0.34)
      : Math.min(260, app.screen.height * 0.38);

    touchMoveHitArea.x = margin;
    touchMoveHitArea.width = Math.max(120, desiredWidth);
    touchMoveHitArea.height = Math.max(120, desiredHeight);
    touchMoveHitArea.y = app.screen.height - touchMoveHitArea.height - margin;
  };

  app.stage.on("pointerdown", (event) => {
    if (
      event.pointerType === "touch" &&
      currentTouchId === null &&
      touchMoveHitArea.contains(event.global.x, event.global.y)
    ) {
      return;
    }

    const pointerStart = {
      x: event.global.x,
      y: event.global.y,
    };

    shootPointerDownPositions.set(event.pointerId, pointerStart);
    aimPointerDownPosition = pointerStart;
    activeAimPointerId = event.pointerId;
  });

  const rocks: Projectile[] = [];

  // Use document listener to also fire on events outside canvas.
  document.addEventListener("pointerup", (event) => {
    const pointerDownPosition = shootPointerDownPositions.get(event.pointerId);
    if (!pointerDownPosition) {
      return;
    }

    shootPointerDownPositions.delete(event.pointerId);
    if (activeAimPointerId === event.pointerId) {
      aimPointerDownPosition = null;
      activeAimPointerId = null;
    }

    const dx = pointerDownPosition.x - event.x;
    const dy = pointerDownPosition.y - event.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 50) {
      const direction = Math.atan2(
        pointerDownPosition.y - event.y,
        pointerDownPosition.x - event.x,
      );
      const velocity = {
        x: Math.cos(direction) * distance * 0.1,
        y: Math.sin(direction) * distance * 0.1,
      };

      const rock = new Projectile(rockTexture, {
        velocity,
        spin: true,
      });
      rock.position.set(player.x, player.y);
      rock.scale.set(
        rock.scale.x * actorScaleMultiplier,
        rock.scale.y * actorScaleMultiplier,
      );
      rockContainer.addChild(rock);
      rocks.push(rock);
    }

    rotateCooldown = 20;
  });

  document.addEventListener("pointercancel", (event) => {
    shootPointerDownPositions.delete(event.pointerId);
    if (activeAimPointerId === event.pointerId) {
      aimPointerDownPosition = null;
      activeAimPointerId = null;
    }
  });

  const maxPlayerSpeed = 5;
  const playerAcceleration = 0.18;
  const playerDeceleration = 0.12;
  const keyboardIntent = { x: 0, y: 0 };
  const touchIntent = { x: 0, y: 0 };
  const playerVelocity = { x: 0, y: 0 };
  let score = 0;

  const scoreContainer = new Container({
    isRenderGroup: true,
    x: 20,
    y: 20,
  });
  const scoreText = new Text({
    text: `Score: ${score}`,
    style: {
      fill: "#fff",
      fontSize: 48,
    },
  });
  scoreContainer.addChild(scoreText);
  app.stage.addChild(scoreContainer);
  updateResponsiveMetrics();
  updateTouchMoveHitArea();

  const gameOverOverlay = new Container({
    isRenderGroup: true,
    visible: false,
  });
  const gameOverBackdrop = new Graphics();
  const gameOverText = new Text({
    text: "",
    style: {
      fill: "#102218",
      fontSize: 48,
      align: "center",
    },
  });
  const resetButton = new Container({
    eventMode: "static",
    cursor: "pointer",
  });
  const resetButtonBg = new Graphics();
  const resetButtonText = new Text({
    text: "Reset",
    style: {
      fill: "#fff",
      fontSize: 28,
    },
  });
  resetButtonText.anchor.set(0.5);
  resetButton.addChild(resetButtonBg);
  resetButton.addChild(resetButtonText);
  gameOverOverlay.addChild(gameOverBackdrop);
  gameOverOverlay.addChild(gameOverText);
  gameOverOverlay.addChild(resetButton);
  app.stage.addChild(gameOverOverlay);

  const layoutGameOverOverlay = () => {
    const width = Math.min(500, app.screen.width - 20);
    const height = Math.min(320, app.screen.height - 20);
    const left = app.screen.width / 2 - width / 2;
    const top = app.screen.height / 2 - height / 2;

    gameOverBackdrop.clear();
    gameOverBackdrop.roundRect(left, top, width, height, 24);
    gameOverBackdrop.fill({ color: 0xf2eddc, alpha: 0.92 });
    gameOverBackdrop.stroke({ color: 0x102218, alpha: 0.25, width: 3 });

    gameOverText.style.fontSize = lerp(20, 56, width / 500);
    gameOverText.anchor.set(0.5);
    gameOverText.position.set(app.screen.width / 2, top + height * 0.38);

    const buttonWidth = Math.min(220, width - 80);
    const buttonHeight = 58;
    resetButtonBg.clear();
    resetButtonBg.roundRect(
      -buttonWidth / 2,
      -buttonHeight / 2,
      buttonWidth,
      buttonHeight,
      18,
    );
    resetButtonBg.fill({ color: 0x2f5740 });
    resetButtonBg.stroke({ color: 0xffffff, alpha: 0.25, width: 2 });
    resetButton.hitArea = new Rectangle(
      -buttonWidth / 2,
      -buttonHeight / 2,
      buttonWidth,
      buttonHeight,
    );
    resetButton.position.set(app.screen.width / 2, top + height * 0.74);
    resetButtonText.position.set(0, 2);
  };

  const updateResponsiveLayout = () => {
    updateResponsiveMetrics();
    app.stage.hitArea = new Rectangle(
      0,
      0,
      app.screen.width,
      app.screen.height,
    );
    updateTouchMoveHitArea();
    drawTouchMoveHint();
    if (currentTouchStart) {
      drawTouchControl();
    }
    layoutGameOverOverlay();
  };

  scheduleViewportRefresh = () => {
    setViewportHeight();
    app.resize();
    updateResponsiveLayout();

    for (const timeout of viewportRefreshTimeouts) {
      window.clearTimeout(timeout);
    }
    viewportRefreshTimeouts = [
      window.setTimeout(() => {
        setViewportHeight();
        app.resize();
        updateResponsiveLayout();
      }, 120),
      window.setTimeout(() => {
        setViewportHeight();
        app.resize();
        updateResponsiveLayout();
      }, 320),
    ];

    window.requestAnimationFrame(() => {
      setViewportHeight();
      app.resize();
      updateResponsiveLayout();
    });
  };

  layoutGameOverOverlay();
  new ResizeObserver(() => {
    updateResponsiveLayout();
  }).observe(pixiContainer);
  window.visualViewport?.addEventListener("resize", scheduleViewportRefresh);
  window.visualViewport?.addEventListener("scroll", scheduleViewportRefresh);
  window.addEventListener("orientationchange", scheduleViewportRefresh);
  window.addEventListener("resize", scheduleViewportRefresh);

  const keysDown = new Set<string>();
  document.addEventListener("keydown", (event) => {
    keysDown.add(event.key);
  });
  document.addEventListener("keyup", (event) => {
    keysDown.delete(event.key);
  });

  enum Movement {
    Up,
    Down,
    Left,
    Right,
  }

  const movementKeys: Record<Movement, string> = {
    [Movement.Up]: "w",
    [Movement.Left]: "a",
    [Movement.Down]: "s",
    [Movement.Right]: "d",
  };

  // const debugGraphics = new Graphics();
  // app.stage.addChild(debugGraphics);
  //
  // const drawBounds = (sprite: Sprite, colour: number) => {
  //   debugGraphics.circle(sprite.x, sprite.y, sprite.width / 2);
  //   debugGraphics.stroke({ width: 2, color: colour });
  // };

  const touchMoveContainer = new Container({
    eventMode: "static",
    hitArea: touchMoveHitArea,
  });
  app.stage.addChild(touchMoveContainer);

  const touchHint = new Graphics({ eventMode: "none" });
  const touchTarget = new Graphics();
  const touchKnob = new Graphics();
  let currentTouchId: number | null = null;
  let currentTouchStart: { x: number; y: number } | null = null;
  touchMoveContainer.addChild(touchHint);
  app.stage.addChild(touchTarget);
  app.stage.addChild(touchKnob);

  const finePointerQuery = window.matchMedia("(any-pointer: fine)");

  const drawArrow = (
    graphics: Graphics,
    x: number,
    y: number,
    angle: number,
    size: number,
  ) => {
    const tipX = x + Math.cos(angle) * size;
    const tipY = y + Math.sin(angle) * size;
    const backX = x - Math.cos(angle) * size * 0.45;
    const backY = y - Math.sin(angle) * size * 0.45;
    const wingAngle = Math.PI / 2;
    const wingSize = size * 0.55;

    graphics.moveTo(tipX, tipY);
    graphics.lineTo(
      backX + Math.cos(angle + wingAngle) * wingSize,
      backY + Math.sin(angle + wingAngle) * wingSize,
    );
    graphics.lineTo(
      backX + Math.cos(angle - wingAngle) * wingSize,
      backY + Math.sin(angle - wingAngle) * wingSize,
    );
    graphics.closePath();
  };

  const drawDirectionalPad = (
    graphics: Graphics,
    centerX: number,
    centerY: number,
    radius: number,
    baseAlpha: number,
    arrowAlpha: number,
  ) => {
    graphics.circle(centerX, centerY, radius);
    graphics.fill({ color: 0xffffff, alpha: baseAlpha });
    graphics.stroke({
      color: 0xffffff,
      alpha: Math.min(baseAlpha + 0.18, 0.6),
      width: 2,
    });

    drawArrow(
      graphics,
      centerX,
      centerY - radius * 0.45,
      -Math.PI / 2,
      radius * 0.32,
    );
    drawArrow(graphics, centerX + radius * 0.45, centerY, 0, radius * 0.32);
    drawArrow(
      graphics,
      centerX,
      centerY + radius * 0.45,
      Math.PI / 2,
      radius * 0.32,
    );
    drawArrow(
      graphics,
      centerX - radius * 0.45,
      centerY,
      Math.PI,
      radius * 0.32,
    );
    graphics.fill({ color: 0xffffff, alpha: arrowAlpha });
  };

  const drawTouchMoveHint = () => {
    touchHint.clear();
    touchHint.visible = !finePointerQuery.matches;
    touchHint.alpha = currentTouchId === null ? 1 : 0.2;

    if (finePointerQuery.matches) {
      return;
    }

    const { x, y, width, height } = touchMoveHitArea;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const outlineRadius = touchPadRadius + 18;

    touchHint.circle(centerX, centerY, outlineRadius);
    touchHint.fill({ color: 0x102218, alpha: 0.18 });
    touchHint.stroke({ color: 0xffffff, alpha: 0.18, width: 2 });

    drawDirectionalPad(touchHint, centerX, centerY, touchPadRadius, 0.07, 0.22);
  };

  drawTouchMoveHint();
  finePointerQuery.addEventListener("change", drawTouchMoveHint);

  const normaliseVector = (vector: { x: number; y: number }) => {
    const length = Math.hypot(vector.x, vector.y);
    if (length > 1) {
      vector.x /= length;
      vector.y /= length;
    }
  };

  const clearTouchMovement = () => {
    touchTarget.clear();
    touchKnob.clear();
    currentTouchId = null;
    currentTouchStart = null;
    touchIntent.x = 0;
    touchIntent.y = 0;
    drawTouchMoveHint();
  };

  const resetGameState = () => {
    gameOverOverlay.visible = false;
    score = 0;
    scoreText.text = `Score: ${score}`;
    player.position.set(app.screen.width / 2, app.screen.height / 2);
    player.rotation = 0;
    playerVelocity.x = 0;
    playerVelocity.y = 0;
    keyboardIntent.x = 0;
    keyboardIntent.y = 0;
    touchIntent.x = 0;
    touchIntent.y = 0;
    keysDown.clear();
    shootPointerDownPositions.clear();
    aimPointerDownPosition = null;
    activeAimPointerId = null;
    rotateCooldown = 0;
    clearTouchMovement();

    for (const rock of rocks) {
      rockContainer.removeChild(rock);
    }
    rocks.length = 0;

    for (const bug of bugs) {
      bugContainer.removeChild(bug);
    }
    bugs.length = 0;

    for (let i = 0; i < 5; i++) {
      newBug();
    }

    ticker.start();
  };

  resetButton.on("pointertap", resetGameState);

  const drawTouchControl = (knobX?: number, knobY?: number) => {
    if (!currentTouchStart) {
      return;
    }

    touchTarget.clear();
    drawDirectionalPad(
      touchTarget,
      currentTouchStart.x,
      currentTouchStart.y,
      touchPadRadius,
      0.2,
      0.45,
    );

    touchKnob.clear();
    touchKnob.circle(
      knobX ?? currentTouchStart.x,
      knobY ?? currentTouchStart.y,
      touchKnobRadius,
    );
    touchKnob.fill({ color: 0xffffff, alpha: 0.45 });
  };

  const updateTouchIntent = (x: number, y: number) => {
    if (!currentTouchStart) {
      return;
    }

    let dx = x - currentTouchStart.x;
    let dy = y - currentTouchStart.y;
    const followDistance = Math.hypot(dx, dy);

    if (followDistance > touchFollowRadius) {
      const overflow = followDistance - touchFollowRadius;
      currentTouchStart.x += (dx / followDistance) * overflow;
      currentTouchStart.y += (dy / followDistance) * overflow;
      dx = x - currentTouchStart.x;
      dy = y - currentTouchStart.y;
    }

    const distance = Math.hypot(dx, dy);
    if (distance <= touchDeadzone) {
      touchIntent.x = 0;
      touchIntent.y = 0;
      drawTouchControl();
      return;
    }

    const clampedDistance = Math.min(distance, touchMaxRadius);
    const angle = Math.atan2(dy, dx);
    const strength = Math.min(
      1,
      (clampedDistance - touchDeadzone) / (touchMaxRadius - touchDeadzone),
    );

    touchIntent.x = Math.cos(angle) * strength;
    touchIntent.y = Math.sin(angle) * strength;

    drawTouchControl(
      currentTouchStart.x + Math.cos(angle) * clampedDistance,
      currentTouchStart.y + Math.sin(angle) * clampedDistance,
    );
  };

  touchMoveContainer.on("touchstart", (event) => {
    if (currentTouchId !== null) {
      return;
    }
    currentTouchId = event.pointerId;
    currentTouchStart = { x: event.global.x, y: event.global.y };
    drawTouchMoveHint();
    drawTouchControl();
  });
  touchMoveContainer.on("globaltouchmove", (event) => {
    if (
      currentTouchId === null ||
      currentTouchStart === null ||
      event.pointerId !== currentTouchId
    ) {
      return;
    }
    updateTouchIntent(event.global.x, event.global.y);
  });

  const handleTouchEnd = (event: { pointerId: number }) => {
    if (event.pointerId !== currentTouchId) {
      return;
    }
    clearTouchMovement();
  };

  touchMoveContainer.on("touchend", handleTouchEnd);
  touchMoveContainer.on("touchendoutside", handleTouchEnd);
  touchMoveContainer.on("touchcancel", handleTouchEnd);

  const ticker = app.ticker.add((time) => {
    keyboardIntent.x = 0;
    keyboardIntent.y = 0;

    if (keysDown.has(movementKeys[Movement.Left])) {
      keyboardIntent.x -= 1;
    }
    if (keysDown.has(movementKeys[Movement.Right])) {
      keyboardIntent.x += 1;
    }
    if (keysDown.has(movementKeys[Movement.Up])) {
      keyboardIntent.y -= 1;
    }
    if (keysDown.has(movementKeys[Movement.Down])) {
      keyboardIntent.y += 1;
    }

    normaliseVector(keyboardIntent);

    const moveIntent = {
      x: keyboardIntent.x + touchIntent.x,
      y: keyboardIntent.y + touchIntent.y,
    };
    normaliseVector(moveIntent);

    const targetVelocity = {
      x: moveIntent.x * maxPlayerSpeed,
      y: moveIntent.y * maxPlayerSpeed,
    };
    const acceleration =
      moveIntent.x === 0 && moveIntent.y === 0
        ? playerDeceleration
        : playerAcceleration;

    playerVelocity.x +=
      (targetVelocity.x - playerVelocity.x) * acceleration * time.deltaTime;
    playerVelocity.y +=
      (targetVelocity.y - playerVelocity.y) * acceleration * time.deltaTime;

    if (Math.abs(playerVelocity.x) < 0.01) {
      playerVelocity.x = 0;
    }
    if (Math.abs(playerVelocity.y) < 0.01) {
      playerVelocity.y = 0;
    }

    player.x += playerVelocity.x * time.deltaTime;
    player.y += playerVelocity.y * time.deltaTime;

    if (bugs.length < score + 10 && Math.random() < 0.01) {
      newBug();
    }

    for (const bug of bugs) {
      bug.update(player, time.deltaTime);
      if (isColliding(player, bug)) {
        ticker.stop();
        gameOverText.text = `Game Over!\nFinal Score: ${score}`;
        layoutGameOverOverlay();
        gameOverOverlay.visible = true;
        return;
      }
    }

    for (let r = rocks.length - 1; r >= 0; r--) {
      const rock = rocks[r];
      rock.update(time.deltaTime);
      if (rock.timeout <= 0) {
        rocks.splice(r, 1);
        rockContainer.removeChild(rock);
        continue;
      }
      if (rock.velocity.x === 0 && rock.velocity.y === 0) {
        rock.timeout -= time.deltaMS;
        continue;
      }

      for (let i = bugs.length - 1; i >= 0; i--) {
        const bug = bugs[i];
        if (!bug.knockback && isColliding(rock, bug)) {
          const speed = Math.sqrt(
            rock.velocity.x * rock.velocity.x +
              rock.velocity.y * rock.velocity.y,
          );
          rock.velocity = {
            x: (rock.x - bug.x) * speed * 0.02,
            y: (rock.y - bug.y) * speed * 0.02,
          };
          bug.knockback = {
            x: (bug.x - rock.x) * speed * 0.005,
            y: (bug.y - rock.y) * speed * 0.005,
          };
          bug.hp -= lerp(1, 3, speed / 20);
        }
        if (!bug.knockback && bug.hp <= 0) {
          scoreText.text = `Score: ${++score}`;
          bugContainer.removeChild(bug);
          bugs.splice(i, 1);
        }
      }
    }

    // Player rotation
    const pointerLocation = app.renderer.events.pointer.global;
    if (rotateCooldown > 0) {
      rotateCooldown = Math.max(0, rotateCooldown - time.deltaTime);
    } else if (
      !aimPointerDownPosition ||
      Math.sqrt(
        (aimPointerDownPosition.x - pointerLocation.x) ** 2 +
          (aimPointerDownPosition.y - pointerLocation.y) ** 2,
      ) < 50
    ) {
      const target = app.renderer.events.pointer.global;
      const targetRotation =
        Math.atan2(target.y - player.y, target.x - player.x) - Math.PI / 2;
      const rawDiff = targetRotation - player.rotation;
      const shortestDiff = Math.atan2(Math.sin(rawDiff), Math.cos(rawDiff));
      player.rotation += shortestDiff * 0.1 * time.deltaTime;
    } else {
      const targetRotation =
        Math.atan2(
          aimPointerDownPosition.y - pointerLocation.y,
          aimPointerDownPosition.x - pointerLocation.x,
        ) -
        Math.PI / 2;
      const rawDiff = targetRotation - player.rotation;
      const shortestDiff = Math.atan2(Math.sin(rawDiff), Math.cos(rawDiff));
      player.rotation += shortestDiff * 0.2 * time.deltaTime;
    }

    // debugGraphics.clear();
    // drawBounds(player, 0x00ff00);
    // for (const bug of bugs) drawBounds(bug, 0xff0000);
    // for (const rock of rocks) drawBounds(rock, 0x00aaff);
  });
})();
