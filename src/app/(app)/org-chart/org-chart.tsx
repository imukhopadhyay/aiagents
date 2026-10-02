"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Minus, Plus, Search } from "lucide-react";

import { PersonAvatar } from "@/components/shared/person-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type TreeNode, buildTree } from "@/lib/domain/org";
import { cn } from "@/lib/utils";

export interface ChartPerson {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  photoUrl: string | null;
  managerId: string | null;
  viewable: boolean;
}

function collectIds(nodes: TreeNode<ChartPerson>[], into = new Set<string>()) {
  for (const node of nodes) {
    into.add(node.id);
    collectIds(node.children, into);
  }
  return into;
}

function PersonCard({ person, highlight }: { person: ChartPerson; highlight: boolean }) {
  const body = (
    <div
      className={cn(
        "bg-card flex w-60 items-center gap-3 rounded-lg border p-3 text-left shadow-xs transition-colors",
        highlight && "ring-primary ring-2",
        person.viewable && "hover:border-foreground/30",
      )}
    >
      <PersonAvatar name={person.name} photoUrl={person.photoUrl} className="size-9" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{person.name}</p>
        <p className="text-muted-foreground truncate text-xs">{person.title ?? "—"}</p>
        {person.department && (
          <p className="text-muted-foreground truncate text-xs">{person.department}</p>
        )}
      </div>
    </div>
  );
  return person.viewable ? <Link href={`/employees/${person.id}`}>{body}</Link> : body;
}

function Branch({
  node,
  collapsed,
  toggle,
  matches,
}: {
  node: TreeNode<ChartPerson>;
  collapsed: Set<string>;
  toggle: (id: string) => void;
  matches: Set<string>;
}) {
  const isCollapsed = collapsed.has(node.id);
  return (
    <li className="relative">
      <div className="flex items-center gap-1">
        {node.children.length > 0 ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-expanded={!isCollapsed}
            aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.name}'s team`}
            onClick={() => toggle(node.id)}
          >
            {isCollapsed ? <ChevronRight /> : <ChevronDown />}
          </Button>
        ) : (
          <span className="size-7" />
        )}
        <PersonCard person={node} highlight={matches.has(node.id)} />
        {node.children.length > 0 && (
          <span className="text-muted-foreground ml-2 text-xs">
            {node.children.length} report{node.children.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {!isCollapsed && node.children.length > 0 && (
        <ul className="border-border mt-2 ml-[0.85rem] grid gap-2 border-l pl-6">
          {node.children.map((child) => (
            <Branch
              key={child.id}
              node={child}
              collapsed={collapsed}
              toggle={toggle}
              matches={matches}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function OrgChart({ people }: { people: ChartPerson[] }) {
  const tree = useMemo(() => buildTree(people, (p) => p.managerId), [people]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return new Set<string>();
    return new Set(
      people
        .filter((p) => `${p.name} ${p.title ?? ""} ${p.department ?? ""}`.toLowerCase().includes(q))
        .map((p) => p.id),
    );
  }, [people, query]);

  // Expand every ancestor of a match so search results are visible.
  const effectiveCollapsed = useMemo(() => {
    if (matches.size === 0) return collapsed;
    const parentOf = new Map(people.map((p) => [p.id, p.managerId]));
    const open = new Set(collapsed);
    for (const id of matches) {
      let parent = parentOf.get(id);
      while (parent) {
        open.delete(parent);
        parent = parentOf.get(parent) ?? null;
      }
    }
    return open;
  }, [collapsed, matches, people]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a person, title or department"
            aria-label="Search the org chart"
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set())}>
          <Plus /> Expand all
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCollapsed(collectIds(tree))}>
          <Minus /> Collapse all
        </Button>
        {query && (
          <span className="text-muted-foreground text-sm">
            {matches.size} match{matches.size === 1 ? "" : "es"}
          </span>
        )}
      </div>
      <div className="overflow-x-auto pb-4">
        <ul className="grid w-max gap-3">
          {tree.map((node) => (
            <Branch
              key={node.id}
              node={node}
              collapsed={effectiveCollapsed}
              toggle={toggle}
              matches={matches}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
