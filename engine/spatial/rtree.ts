// A dynamic R-tree (A2 M6): boxes with values, for hit-testing, snapping and (later) rule checks.
// Guttman's tree: insert descends by least enlargement; an overfull node splits along the axis
// with the smallest total margin, at the position with the least overlap; removal shrinks the
// path and re-inserts the entries of nodes left underfull. Values are compared with ===.

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Entry<T> {
  box: Box;
  value: T;
}

interface Node<T> {
  box: Box;
  leaf: boolean;
  /** Entries in a leaf, nodes otherwise. */
  kids: (Node<T> | Entry<T>)[];
}

const MAX = 9;
const MIN = 4;

const empty = (): Box => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
const area = (b: Box) => (b.maxX - b.minX) * (b.maxY - b.minY);
const margin = (b: Box) => b.maxX - b.minX + (b.maxY - b.minY);
const intersects = (a: Box, b: Box) =>
  a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
const contains = (a: Box, b: Box) =>
  a.minX <= b.minX && a.minY <= b.minY && b.maxX <= a.maxX && b.maxY <= a.maxY;

function extend(a: Box, b: Box): Box {
  a.minX = Math.min(a.minX, b.minX);
  a.minY = Math.min(a.minY, b.minY);
  a.maxX = Math.max(a.maxX, b.maxX);
  a.maxY = Math.max(a.maxY, b.maxY);
  return a;
}
const union = (a: Box, b: Box) => extend({ ...a }, b);
function boxOf<T>(kids: readonly (Node<T> | Entry<T>)[], from = 0, to = kids.length): Box {
  const b = empty();
  for (let i = from; i < to; i++) extend(b, kids[i]!.box);
  return b;
}
function overlap(a: Box, b: Box) {
  const w = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const h = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  return w > 0 && h > 0 ? w * h : 0;
}

export class RTree<T> {
  private root: Node<T> = { box: empty(), leaf: true, kids: [] };
  private count = 0;

  get size(): number {
    return this.count;
  }

  insert(box: Box, value: T): void {
    this.insertEntry({ box: { ...box }, value });
    this.count++;
  }

  /** Removes one entry with this value whose box lies inside `box`; false if none. */
  remove(box: Box, value: T): boolean {
    const path: Node<T>[] = [];
    const found = this.findLeaf(this.root, box, value, path);
    if (!found) return false;
    const leaf = path.at(-1)!;
    leaf.kids.splice(leaf.kids.indexOf(found), 1);
    this.count--;
    // Condense: drop underfull nodes (re-inserting their entries), shrink the rest.
    const orphans: Entry<T>[] = [];
    for (let i = path.length - 1; i > 0; i--) {
      const node = path[i]!;
      const parent = path[i - 1]!;
      if (node.kids.length < MIN) {
        parent.kids.splice(parent.kids.indexOf(node), 1);
        collect(node, orphans);
      } else node.box = boxOf(node.kids);
    }
    this.root.box = boxOf(this.root.kids);
    while (!this.root.leaf && this.root.kids.length === 1) this.root = this.root.kids[0] as Node<T>;
    if (!this.root.leaf && this.root.kids.length === 0)
      this.root = { box: empty(), leaf: true, kids: [] };
    for (const e of orphans) this.insertEntry(e);
    return true;
  }

  /** Values whose boxes touch `box`. */
  search(box: Box): T[] {
    const out: T[] = [];
    const stack: Node<T>[] = intersects(this.root.box, box) ? [this.root] : [];
    while (stack.length) {
      const node = stack.pop()!;
      for (const kid of node.kids) {
        if (!intersects(kid.box, box)) continue;
        if (node.leaf) out.push((kid as Entry<T>).value);
        else stack.push(kid as Node<T>);
      }
    }
    return out;
  }

  all(): T[] {
    const out: Entry<T>[] = [];
    collect(this.root, out);
    return out.map((e) => e.value);
  }

  /** Throws if a structural rule is broken (for tests). Returns the tree height. */
  check(): number {
    const depths = new Set<number>();
    const walk = (node: Node<T>, depth: number, isRoot: boolean) => {
      if (!isRoot && (node.kids.length < MIN || node.kids.length > MAX))
        throw new Error(`node with ${node.kids.length} children`);
      if (node.kids.length) {
        const b = boxOf(node.kids);
        const n = node.box;
        if (b.minX !== n.minX || b.minY !== n.minY || b.maxX !== n.maxX || b.maxY !== n.maxY)
          throw new Error('node box is not the union of its children');
      }
      if (node.leaf) depths.add(depth);
      else for (const kid of node.kids) walk(kid as Node<T>, depth + 1, false);
    };
    walk(this.root, 1, true);
    if (depths.size > 1) throw new Error('leaves at different depths');
    return [...depths][0] ?? 1;
  }

  private insertEntry(entry: Entry<T>) {
    const path: Node<T>[] = [this.root];
    let node = this.root;
    while (!node.leaf) {
      let best: Node<T> | undefined;
      let bestGrowth = Infinity;
      let bestArea = Infinity;
      for (const kid of node.kids as Node<T>[]) {
        const a = area(kid.box);
        const growth = area(union(kid.box, entry.box)) - a;
        if (growth < bestGrowth || (growth === bestGrowth && a < bestArea)) {
          best = kid;
          bestGrowth = growth;
          bestArea = a;
        }
      }
      node = best!;
      path.push(node);
    }
    node.kids.push(entry);
    for (const n of path) extend(n.box, entry.box);
    // Split overfull nodes from the leaf up.
    for (let i = path.length - 1; i >= 0; i--) {
      const n = path[i]!;
      if (n.kids.length <= MAX) break;
      const sibling = split(n);
      if (i > 0) path[i - 1]!.kids.push(sibling);
      else {
        this.root = { box: union(n.box, sibling.box), leaf: false, kids: [n, sibling] };
      }
    }
  }

  private findLeaf(node: Node<T>, box: Box, value: T, path: Node<T>[]): Entry<T> | null {
    path.push(node);
    if (node.leaf) {
      const e = (node.kids as Entry<T>[]).find((k) => k.value === value && contains(box, k.box));
      if (e) return e;
    } else {
      for (const kid of node.kids as Node<T>[]) {
        if (!intersects(kid.box, box)) continue;
        const e = this.findLeaf(kid, box, value, path);
        if (e) return e;
      }
    }
    path.pop();
    return null;
  }
}

function collect<T>(node: Node<T>, out: Entry<T>[]) {
  if (node.leaf) out.push(...(node.kids as Entry<T>[]));
  else for (const kid of node.kids as Node<T>[]) collect(kid, out);
}

/** Splits an overfull node in place; returns the new sibling. */
function split<T>(node: Node<T>): Node<T> {
  const kids = node.kids;
  const byX = [...kids].sort((a, b) => a.box.minX - b.box.minX || a.box.maxX - b.box.maxX);
  const byY = [...kids].sort((a, b) => a.box.minY - b.box.minY || a.box.maxY - b.box.maxY);
  const marginSum = (sorted: typeof kids) => {
    let sum = 0;
    for (let k = MIN; k <= sorted.length - MIN; k++)
      sum += margin(boxOf(sorted, 0, k)) + margin(boxOf(sorted, k));
    return sum;
  };
  const sorted = marginSum(byX) <= marginSum(byY) ? byX : byY;
  let bestK = MIN;
  let bestOverlap = Infinity;
  let bestArea = Infinity;
  for (let k = MIN; k <= sorted.length - MIN; k++) {
    const a = boxOf(sorted, 0, k);
    const b = boxOf(sorted, k);
    const o = overlap(a, b);
    const s = area(a) + area(b);
    if (o < bestOverlap || (o === bestOverlap && s < bestArea)) {
      bestK = k;
      bestOverlap = o;
      bestArea = s;
    }
  }
  node.kids = sorted.slice(0, bestK);
  node.box = boxOf(node.kids);
  const rest = sorted.slice(bestK);
  return { box: boxOf(rest), leaf: node.leaf, kids: rest };
}

/** The box around some points, grown by `pad` on every side. */
export function boxAround(points: readonly (readonly [number, number])[], pad = 0): Box {
  const b = empty();
  for (const [x, y] of points) extend(b, { minX: x, minY: y, maxX: x, maxY: y });
  return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
}
