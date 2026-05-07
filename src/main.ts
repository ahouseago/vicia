import { Application, Assets, Rectangle, Sprite } from "pixi.js";

(async () => {
  // Create a new application
  const app = new Application();

  // Initialize the application
  await app.init({ background: "#395f3f", resizeTo: window });

  // Append the application canvas to the document body
  document.getElementById("pixi-container")?.appendChild(app.canvas);

  // Load the bug texture
  const texture = await Assets.load("/assets/bug.svg");

  // Create a bug Sprite
  const bug = new Sprite(texture);

  // Center the sprite's anchor point
  bug.anchor.set(0.5);

  // Move the sprite to the center of the screen
  bug.position.set(app.screen.width / 2, app.screen.height / 2);

  // Add the bug to the stage
  app.stage.addChild(bug);

  app.stage.eventMode = "static";
  app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);

  // Variables to remember where we want to go
  let targetX = bug.x;
  let targetY = bug.y;
  let vx = 0;
  let vy = 0;
  const acceleration = 0.4;
  const maxSpeed = 1;

  let isMoving = false;
  app.stage.on("pointerdown", (event) => {
    targetX = event.global.x;
    targetY = event.global.y;
    isMoving = true;
  });
  app.stage.on("pointerup", () => {
    isMoving = false;
    vx = 0;
    vy = 0;
  });
  app.stage.on("pointermove", (e) => {
    if (isMoving) {
      targetX = e.global.x;
      targetY = e.global.y;
    }
  });

  app.ticker.add((time) => {
    const current = bug.rotation;
    const cursor = app.renderer.events.pointer.global;
    const target = Math.atan2(cursor.y - bug.y, cursor.x - bug.x) + Math.PI / 2;
    const rawDiff = target - current;
    const shortestDiff = Math.atan2(Math.sin(rawDiff), Math.cos(rawDiff));
    bug.rotation = current + shortestDiff * 0.05 * time.deltaTime;

    if (isMoving) {
      const dx = targetX - bug.x;
      const dy = targetY - bug.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 0) {
        const angle = bug.rotation - Math.PI / 2;
        vx += Math.cos(angle) * acceleration;
        vy += Math.sin(angle) * acceleration;
        const currentSpeed = Math.sqrt(vx * vx + vy * vy);

        if (currentSpeed > maxSpeed) {
          vx = (vx / currentSpeed) * maxSpeed;
          vy = (vy / currentSpeed) * maxSpeed;
        }

        // If the distance to the target is less than our speed this frame snap to it.
        if (distance <= currentSpeed) {
          bug.x = targetX;
          bug.y = targetY;
          vx = 0;
          vy = 0;
        } else {
          // Otherwise, apply the velocity to move the bug
          bug.x += vx;
          bug.y += vy;
        }
      }
    }
  });
})();
