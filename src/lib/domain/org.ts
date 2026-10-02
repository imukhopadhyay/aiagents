/**
 * Whether making `newParentId` the parent of `nodeId` would create a cycle.
 * `parentOf` maps every node to its current parent (or null).
 * Works for both department trees and reporting lines.
 */
export function wouldCreateCycle(
  nodeId: string,
  newParentId: string | null | undefined,
  parentOf: ReadonlyMap<string, string | null>,
): boolean {
  const seen = new Set<string>();
  let current = newParentId ?? null;
  while (current) {
    if (current === nodeId) return true;
    if (seen.has(current)) return true; // existing data already has a cycle
    seen.add(current);
    current = parentOf.get(current) ?? null;
  }
  return false;
}

export type TreeNode<T> = T & { children: TreeNode<T>[] };

/** Build a forest from flat records. Orphans (parent missing) become roots. */
export function buildTree<T extends { id: string }>(
  items: readonly T[],
  getParentId: (item: T) => string | null | undefined,
): TreeNode<T>[] {
  const nodes = new Map<string, TreeNode<T>>();
  for (const item of items) nodes.set(item.id, { ...item, children: [] });

  const roots: TreeNode<T>[] = [];
  for (const item of items) {
    const node = nodes.get(item.id)!;
    const parentId = getParentId(item);
    const parent = parentId ? nodes.get(parentId) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Ids of every descendant of `rootId`. */
export function descendantIds(
  rootId: string,
  items: readonly { id: string; parentId: string | null }[],
): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const item of items) {
    if (!item.parentId) continue;
    const list = childrenOf.get(item.parentId) ?? [];
    list.push(item.id);
    childrenOf.set(item.parentId, list);
  }
  const result = new Set<string>();
  const stack = [...(childrenOf.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    stack.push(...(childrenOf.get(id) ?? []));
  }
  return result;
}
