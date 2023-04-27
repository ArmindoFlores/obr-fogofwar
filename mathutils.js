export function distance(P1, P2) {
  return Math.sqrt((P1.x - P2.x) * (P1.x - P2.x) + (P1.y - P2.y) * (P1.y - P2.y));
}

export function squareDistance(P1, P2) {
  return (P1.x - P2.x) * (P1.x - P2.x) + (P1.y - P2.y) * (P1.y - P2.y);
}

export function comparePosition(p1, p2) {
  return p1.x == p2.x && p1.y == p2.y;
}

export function isClose(x1, x2, tol) {
  if (tol === undefined)
    tol = 0.01;
  return Math.abs(x1 - x2) <= tol;
}

export function mod(n, m) {
  return ((n % m) + m) % m;
}