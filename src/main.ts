import { Application, Assets, Point, Rectangle } from "pixi.js";
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
  bug.position.set(app.screen.width / 2, app.screen.height / 2);
  app.stage.addChild(bug);

  app.stage.eventMode = "static";
  app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);

  let mouseIsDown = false;
  app.stage.on("pointerdown", () => {
    mouseIsDown = true;
  });
  app.stage.on("pointerup", () => {
    mouseIsDown = false;
  });

  app.ticker.add((time) => {
    if (mouseIsDown) {
      bug.moveTowards(app.renderer.events.pointer.global, time.deltaTime);
    }
  });
})();
