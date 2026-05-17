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

  // Initialize the asset loader with the base path for assets
  await Assets.init({ basePath: import.meta.env.BASE_URL });

  // Initialize the application
  await app.init({ background: "#395f3f", resizeTo: window });

  // Append the application canvas to the document body
  document.getElementById("pixi-container")?.appendChild(app.canvas);

  const rockTexture = await Assets.load("assets/rock.png");
  const rockContainer = new Container();
  app.stage.addChild(rockContainer);

  const bugTexture = await Assets.load("assets/bug.svg");
  const bugContainer = new Container();
  app.stage.addChild(bugContainer);
  const bugs: Bug[] = [];
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
    bugContainer.addChild(bug);
    bugs.push(bug);
  };

  for (let i = 0; i < 5; i++) {
    newBug();
  }

  const playerTexture = await Assets.load("assets/character.png");
  const player = new Sprite(playerTexture);
  player.anchor.set(0.5);
  player.scale.set(0.25);
  player.position.set(app.screen.width / 2, app.screen.height / 2);
  app.stage.addChild(player);

  app.stage.eventMode = "static";
  app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);

  const shootPointerDownPositions = new Map<number, { x: number; y: number }>();
  let aimPointerDownPosition: { x: number; y: number } | null = null;
  let activeAimPointerId: number | null = null;
  let rotateCooldown = 0;

  const touchMoveHitArea = new Rectangle(
    0,
    Math.max(0, app.screen.height - 600),
    app.screen.width / 3,
    Math.min(app.screen.height, 600),
  );

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

  const touchTarget = new Graphics();
  const touchKnob = new Graphics();
  let currentTouchId: number | null = null;
  let currentTouchStart: { x: number; y: number } | null = null;
  app.stage.addChild(touchTarget);
  app.stage.addChild(touchKnob);

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
  };

  const drawTouchControl = (knobX?: number, knobY?: number) => {
    if (!currentTouchStart) {
      return;
    }

    touchTarget.clear();
    touchTarget.circle(currentTouchStart.x, currentTouchStart.y, 30);
    touchTarget.fill({ color: 0xffffff, alpha: 0.2 });
    touchTarget.stroke({ color: 0xffffff, alpha: 0.5, width: 2 });

    touchKnob.clear();
    touchKnob.circle(
      knobX ?? currentTouchStart.x,
      knobY ?? currentTouchStart.y,
      20,
    );
    touchKnob.fill({ color: 0xffffff, alpha: 0.45 });
  };

  const updateTouchIntent = (x: number, y: number) => {
    if (!currentTouchStart) {
      return;
    }

    const maxRadius = 70;
    const deadzone = 10;
    const followRadius = 90;
    let dx = x - currentTouchStart.x;
    let dy = y - currentTouchStart.y;
    const followDistance = Math.hypot(dx, dy);

    if (followDistance > followRadius) {
      const overflow = followDistance - followRadius;
      currentTouchStart.x += (dx / followDistance) * overflow;
      currentTouchStart.y += (dy / followDistance) * overflow;
      dx = x - currentTouchStart.x;
      dy = y - currentTouchStart.y;
    }

    const distance = Math.hypot(dx, dy);
    if (distance <= deadzone) {
      touchIntent.x = 0;
      touchIntent.y = 0;
      drawTouchControl();
      return;
    }

    const clampedDistance = Math.min(distance, maxRadius);
    const angle = Math.atan2(dy, dx);
    const strength = Math.min(
      1,
      (clampedDistance - deadzone) / (maxRadius - deadzone),
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

    if (bugs.length < 10 && Math.random() < 0.01) {
      newBug();
    }

    for (const bug of bugs) {
      bug.update(player, time.deltaTime);
      if (isColliding(player, bug)) {
        // Reset game
        ticker.stop();
        const scoreGraphic = new Graphics();
        const width = Math.min(500, app.screen.width - 20);
        const height = Math.min(300, app.screen.height - 20);
        scoreGraphic.rect(
          app.screen.width / 2 - width / 2,
          app.screen.height / 2 - height / 2,
          width,
          height,
        );
        scoreGraphic.fill({ color: 0xffffff, alpha: 0.6 });
        app.stage.addChild(scoreGraphic);

        const finalScoreText = new Text({
          text: `Game Over!\nFinal Score: ${score}`,
          style: {
            fill: "#000",
            fontSize: lerp(16, 64, width / 500),
            align: "center",
          },
        });
        finalScoreText.anchor.set(0.5);
        finalScoreText.position.set(
          app.screen.width / 2,
          app.screen.height / 2,
        );
        app.stage.addChild(finalScoreText);

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
