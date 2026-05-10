import { Application, Assets, Rectangle, Sprite } from "pixi.js";
import { Bug } from "./components/bug";
import { Projectile } from "./components/projectile";
import { lerp } from "./utils/lerp";

(async () => {
  // Create a new application
  const app = new Application();

  // Initialize the application
  await app.init({ background: "#395f3f", resizeTo: window });

  // Append the application canvas to the document body
  document.getElementById("pixi-container")?.appendChild(app.canvas);

  const bugTexture = await Assets.load("/assets/bug.svg");

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
    app.stage.addChild(bug);
    bugs.push(bug);
  };

  for (let i = 0; i < 5; i++) {
    newBug();
  }

  const rockTexture = await Assets.load("/assets/rock.png");

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
      app.stage.addChild(rock);
      rocks.push(rock);
    }

    pointerDownPosition = null;
    rotateCooldown = 20;
  });

  const playerSpeed = 5;
  let score = 0;

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

    if (bugs.length < 10 && Math.random() < 0.01) {
      newBug();
    }

    for (const bug of bugs) {
      bug.update(player.position, time.deltaTime);
    }

    for (const rock of rocks) {
      rock.update(time.deltaTime);

      for (let i = bugs.length - 1; i >= 0; i--) {
        const bug = bugs[i];
        if (!rock.knockback && !bug.knockback && isColliding(rock, bug)) {
          const speed = Math.sqrt(
            rock.velocity.x * rock.velocity.x +
              rock.velocity.y * rock.velocity.y,
          );
          rock.knockback = {
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
          score++;
          console.log("Score:", score);
          app.stage.removeChild(bug);
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
  });
})();

type Collidable = {
  x: number;
  y: number;
  width: number;
};

const isColliding = (a: Collidable, b: Collidable) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distanceSquared = dx * dx + dy * dy;
  return distanceSquared <= (a.width + b.width) ** 2;
};
