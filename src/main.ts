import { Application, Assets, Point, Rectangle, Sprite } from "pixi.js";
import { Bug } from "./components/bug";

(async () => {
  // Create a new application
  const app = new Application();

  // Initialize the application
  await app.init({ background: "#395f3f", resizeTo: window });

  // Append the application canvas to the document body
  document.getElementById("pixi-container")?.appendChild(app.canvas);

  const bugTexture = await Assets.load("/assets/bug.svg");
  const bug = new Bug(bugTexture, {
    velocity: new Point(),
    maxSpeed: 1,
    acceleration: 0.4,
  });
  bug.position.set(app.screen.width / 2, app.screen.height - 50);
  app.stage.addChild(bug);

  const playerTexture = await Assets.load("/assets/character.png");
  const player = new Sprite(playerTexture);
  player.anchor.set(0.5);
  player.scale.set(0.25);
  player.position.set(app.screen.width / 2, app.screen.height / 2);
  app.stage.addChild(player);

  app.stage.eventMode = "static";
  app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);

  let pointerDownPosition: { x: number; y: number } | null = null;
  let rotateCooldown = 0;
  app.stage.on("pointerdown", (event) => {
    pointerDownPosition = { x: event.global.x, y: event.global.y };
  });
  // Use document listener to also fire on events outside canvas.
  document.addEventListener("pointerup", () => {
    pointerDownPosition = null;
    rotateCooldown = 20;
  });

  const playerSpeed = 5;

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

  app.ticker.add((time) => {
    if (keysDown.size > 0) {
      for (const m of [
        Movement.Up,
        Movement.Down,
        Movement.Left,
        Movement.Right,
      ]) {
        if (!keysDown.has(movementKeys[m])) {
          continue;
        }
        switch (m) {
          case Movement.Up:
            player.y -= playerSpeed * time.deltaTime;
            break;
          case Movement.Down:
            player.y += playerSpeed * time.deltaTime;
            break;
          case Movement.Left:
            player.x -= playerSpeed * time.deltaTime;
            break;
          case Movement.Right:
            player.x += playerSpeed * time.deltaTime;
            break;
        }
      }
    }

    bug.moveTowards(player.position, time.deltaTime);

    // Player rotation
    const pointerLocation = app.renderer.events.pointer.global;
    if (rotateCooldown > 0) {
      rotateCooldown = Math.max(0, rotateCooldown - time.deltaTime);
    } else if (
      !pointerDownPosition ||
      Math.sqrt(
        (pointerDownPosition.x - pointerLocation.x) ** 2 +
          (pointerDownPosition.y - pointerLocation.y) ** 2,
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
          pointerDownPosition.y - pointerLocation.y,
          pointerDownPosition.x - pointerLocation.x,
        ) -
        Math.PI / 2;
      const rawDiff = targetRotation - player.rotation;
      const shortestDiff = Math.atan2(Math.sin(rawDiff), Math.cos(rawDiff));
      player.rotation += shortestDiff * 0.2 * time.deltaTime;
    }
  });
})();
