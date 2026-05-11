type Collidable = {
  x: number;
  y: number;
  width: number;
};

export const isColliding = (a: Collidable, b: Collidable) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distanceSquared = dx * dx + dy * dy;
  return distanceSquared <= (a.width / 2 + b.width / 2) ** 2;
};
