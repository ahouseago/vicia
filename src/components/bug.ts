import { Point, Sprite, Texture } from "pixi.js";
import { lerp } from "../utils/lerp";

type BugProperties = {
  maxSpeed: number;
  acceleration: number;
  /**  size between 1 and 10, default 5 */
  size?: number;
};

export class Bug extends Sprite {
  velocity: { x: number; y: number };
  knockback?: { x: number; y: number };
  maxSpeed: number;
  acceleration: number;
  hp: number;

  constructor(texture: Texture, props: BugProperties) {
    super(texture);

    // Center the sprite's anchor point
    this.anchor.set(0.5);

    this.velocity = { x: 0, y: 0 };
    this.maxSpeed = props.maxSpeed;
    this.acceleration = props.acceleration;

    this.hp = 3;

    if (props.size && props.size >= 1 && props.size <= 10) {
      this.scale.set(lerp(0.6, 2, props.size / 10));
      this.maxSpeed = lerp(
        this.maxSpeed * 2,
        this.maxSpeed / 2,
        props.size / 10,
      );

      this.hp = Math.round(lerp(1, 5, props.size / 10));
    }
  }

  update(target: Point, deltaTime: number) {
    if (this.knockback) {
      if (
        Math.abs(this.knockback.x) < 0.01 &&
        Math.abs(this.knockback.y) < 0.01
      ) {
        this.knockback = undefined;
        return;
      }
      this.position.x += this.knockback.x * deltaTime;
      this.position.y += this.knockback.y * deltaTime;
      this.knockback.x *= 0.9;
      this.knockback.y *= 0.9;

      return;
    }

    const targetRotation =
      Math.atan2(target.y - this.y, target.x - this.x) + Math.PI / 2;
    const rawDiff = targetRotation - this.rotation;
    const shortestDiff = Math.atan2(Math.sin(rawDiff), Math.cos(rawDiff));
    this.rotation += shortestDiff * 0.05 * deltaTime;

    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const distanceSquared = dx * dx + dy * dy;

    if (distanceSquared > Math.max(this.width, this.height) ** 2) {
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
      if (distanceSquared <= currentSpeed ** 2) {
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
