import { Sprite, Texture } from "pixi.js";

type ProjectileProperties = {
  velocity: { x: number; y: number };
  spin: boolean;
};

export class Projectile extends Sprite {
  velocity: { x: number; y: number };
  spin: boolean;

  constructor(texture: Texture, props: ProjectileProperties) {
    super(texture);

    // Center the sprite's anchor point
    this.anchor.set(0.5);
    this.scale.set(0.5);

    this.velocity = props.velocity;
    this.spin = props.spin;
  }

  update(deltaTime: number) {
    if (
      Math.abs(this.velocity.x) < 0.005 &&
      Math.abs(this.velocity.y) < 0.005
    ) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      return;
    }

    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;

    if (this.spin) {
      this.rotation +=
        Math.max(Math.abs(this.velocity.x), Math.abs(this.velocity.y)) *
        0.05 *
        deltaTime;
    }

    this.velocity.x *= 0.95;
    this.velocity.y *= 0.95;
  }
}
