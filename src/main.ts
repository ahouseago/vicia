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

  let pointerDownPosition: { x: number; y: number } | null = null;
  let rotateCooldown = 0;
  app.stage.on("pointerdown", (event) => {
    pointerDownPosition = { x: event.global.x, y: event.global.y };
  });

  const rocks: Projectile[] = [];

  // Use document listener to also fire on events outside canvas.
  document.addEventListener("pointerup", (event) => {
    if (!pointerDownPosition) {
      return;
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

    pointerDownPosition = null;
    rotateCooldown = 20;
  });

  const playerSpeed = 5;
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

  const ticker = app.ticker.add((time) => {
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

    // debugGraphics.clear();
    // drawBounds(player, 0x00ff00);
    // for (const bug of bugs) drawBounds(bug, 0xff0000);
    // for (const rock of rocks) drawBounds(rock, 0x00aaff);
  });
})();
