import { Point, Sprite, Texture } from "pixi.js";

type BugProperties = {
  velocity: Point;
  maxSpeed: number;
  acceleration: number;
};

export class Bug extends Sprite {
  velocity: Point;
  maxSpeed: number;
  acceleration: number;

  constructor(texture: Texture, props: BugProperties) {
    super(texture);

    // Center the sprite's anchor point
    this.anchor.set(0.5);

    this.velocity = props.velocity;
    this.maxSpeed = props.maxSpeed;
    this.acceleration = props.acceleration;
  }

  moveTowards(target: Point, deltaTime: number) {
    const targetRotation =
      Math.atan2(target.y - this.y, target.x - this.x) + Math.PI / 2;
    const rawDiff = targetRotation - this.rotation;
    const shortestDiff = Math.atan2(Math.sin(rawDiff), Math.cos(rawDiff));
    this.rotation += shortestDiff * 0.05 * deltaTime;

    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > Math.max(this.width, this.height)) {
      const angle = this.rotation - Math.PI / 2;
      this.velocity.x += Math.cos(angle) * this.acceleration;
      this.velocity.y += Math.sin(angle) * this.acceleration;
      const currentSpeed = Math.sqrt(
        this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y,
      );

      if (currentSpeed > this.maxSpeed) {
        this.velocity.x = (this.velocity.x / currentSpeed) * this.maxSpeed;
        this.velocity.y = (this.velocity.y / currentSpeed) * this.maxSpeed;
      }

      // If the distance to the target is less than our speed this frame snap to it.
      if (distance <= currentSpeed) {
        this.position.x = target.x;
        this.position.y = target.y;
        this.velocity.x = 0;
        this.velocity.y = 0;
      } else {
        // Otherwise, apply the velocity to move the this
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
      }
    }
  }
}
