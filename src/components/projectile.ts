import { Sprite, Texture } from "pixi.js";

type ProjectileProperties = {
  velocity: { x: number; y: number };
  spin: boolean;
};

export class Projectile extends Sprite {
  velocity: { x: number; y: number };
  spin: number;

  // After lying stationary, how many ms before the projectile disappears
  timeout: number = 10_000;

  constructor(texture: Texture, props: ProjectileProperties) {
    super(texture);

    // Center the sprite's anchor point
    this.anchor.set(0.5);
    this.scale.set(Math.random() * 0.2 + 0.4);

    this.velocity = props.velocity;
    this.spin = props.spin ? Math.random() / 2 : 0;
  }

  update(deltaTime: number) {
    if (this.timeout < 300) {
      this.alpha = this.timeout / 300;
    }

    if (Math.abs(this.velocity.x) < 0.05 && Math.abs(this.velocity.y) < 0.05) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      return;
    }

    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;

    if (this.spin) {
      this.rotation +=
        this.spin *
        Math.max(Math.abs(this.velocity.x), Math.abs(this.velocity.y)) *
        deltaTime;
    }

    this.velocity.x *= 0.95;
    this.velocity.y *= 0.95;
  }
}
