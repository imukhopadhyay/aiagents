"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { GripVertical, MoreHorizontal, Star } from "lucide-react";
import { toast } from "sonner";

import { PersonAvatar } from "@/components/shared/person-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PIPELINE_STAGES, STAGE_LABELS, type Stage, canMoveStage } from "@/lib/domain/recruitment";
import { cn } from "@/lib/utils";

import { moveStageAction } from "../../actions";

export interface PipelineCard {
  id: string;
  stage: Stage;
  candidateId: string;
  name: string;
  email: string;
  tags: string[];
  appliedAt: string;
  interviews: number;
  avgRating: number | null;
  rejectionReason: string | null;
}

type Column = (typeof PIPELINE_STAGES)[number] | "CLOSED";
const COLUMNS: Column[] = [...PIPELINE_STAGES, "CLOSED"];
const columnOf = (stage: Stage): Column => (stage === "REJECTED" || stage === "WITHDRAWN" ? "CLOSED" : stage);

function CardBody({
  card,
  canManage,
  onMove,
  dragHandle,
}: {
  card: PipelineCard;
  canManage: boolean;
  onMove: (card: PipelineCard, stage: Stage) => void;
  dragHandle?: React.ReactNode;
}) {
  return (
    <div className="bg-card grid gap-2 rounded-lg border p-3 shadow-xs">
      <div className="flex items-start gap-2">
        {dragHandle}
        <PersonAvatar name={card.name} className="size-7" />
        <div className="min-w-0 flex-1">
          <Link href={`/recruitment/candidates/${card.candidateId}`} className="block truncate text-sm font-medium hover:underline">
            {card.name}
          </Link>
          <p className="text-muted-foreground truncate text-xs">{card.email}</p>
        </div>
        {canManage && card.stage !== "HIRED" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" aria-label={`Move ${card.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {(["APPLIED", "SCREENING", "INTERVIEW", "OFFER"] as Stage[])
                .filter((s) => canMoveStage(card.stage, s))
                .map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => onMove(card, s)}>
                    {STAGE_LABELS[s]}
                  </DropdownMenuItem>
                ))}
              <DropdownMenuSeparator />
              {(["REJECTED", "WITHDRAWN"] as Stage[])
                .filter((s) => canMoveStage(card.stage, s))
                .map((s) => (
                  <DropdownMenuItem key={s} variant={s === "REJECTED" ? "destructive" : "default"} onSelect={() => onMove(card, s)}>
                    {STAGE_LABELS[s]}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        {card.stage === "REJECTED" || card.stage === "WITHDRAWN" ? (
          <Badge variant="outline">{STAGE_LABELS[card.stage]}</Badge>
        ) : null}
        {card.interviews > 0 && <span>{card.interviews} interview(s)</span>}
        {card.avgRating !== null && (
          <span className="flex items-center gap-0.5">
            <Star className="size-3 fill-current" /> {card.avgRating.toFixed(1)}
          </span>
        )}
        {card.tags.slice(0, 3).map((t) => (
          <Badge key={t} variant="secondary" className="px-1.5 text-[10px]">
            {t}
          </Badge>
        ))}
      </div>
      {card.rejectionReason && <p className="text-muted-foreground text-xs italic">“{card.rejectionReason}”</p>}
    </div>
  );
}

function DraggableCard(props: { card: PipelineCard; canManage: boolean; onMove: (card: PipelineCard, stage: Stage) => void }) {
  const draggable = props.canManage && props.card.stage !== "HIRED";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: props.card.id,
    disabled: !draggable,
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "relative z-50 opacity-80 shadow-lg")}>
      <CardBody
        {...props}
        dragHandle={
          draggable ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground -ml-1 cursor-grab touch-none rounded p-0.5 active:cursor-grabbing"
              aria-label={`Drag ${props.card.name} to another stage`}
              {...listeners}
              {...attributes}
            >
              <GripVertical className="size-4" />
            </button>
          ) : null
        }
      />
    </div>
  );
}

function StageColumn({ column, children, count }: { column: Column; children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: column });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-muted/40 flex w-64 shrink-0 flex-col gap-2 rounded-xl border p-2 transition-colors",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between px-1 py-1">
        <h3 className="text-sm font-medium">{column === "CLOSED" ? "Rejected / withdrawn" : STAGE_LABELS[column]}</h3>
        <Badge variant="secondary">{count}</Badge>
      </div>
      <div className="grid min-h-24 content-start gap-2">{children}</div>
    </div>
  );
}

export function PipelineBoard({ cards, canManage }: { cards: PipelineCard[]; canManage: boolean }) {
  const [optimistic, applyMove] = useOptimistic(cards, (state, move: { id: string; stage: Stage }) =>
    state.map((c) => (c.id === move.id ? { ...c, stage: move.stage } : c)),
  );
  const [, startTransition] = useTransition();
  const [closing, setClosing] = useState<{ card: PipelineCard; stage: Stage } | null>(null);
  const [reason, setReason] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  function commit(card: PipelineCard, stage: Stage, rejectionReason?: string) {
    startTransition(async () => {
      applyMove({ id: card.id, stage });
      const result = await moveStageAction({ applicationId: card.id, stage, rejectionReason });
      if (result.ok) toast.success(`${card.name}: ${result.message}`);
      else toast.error(result.error);
    });
  }

  function move(card: PipelineCard, stage: Stage) {
    if (!canMoveStage(card.stage, stage)) {
      toast.error(stage === "HIRED" ? "Hire candidates from their accepted offer." : "That move isn't allowed.");
      return;
    }
    if (stage === "REJECTED" || stage === "WITHDRAWN") {
      setReason("");
      setClosing({ card, stage });
      return;
    }
    commit(card, stage);
  }

  function onDragEnd(event: DragEndEvent) {
    const card = optimistic.find((c) => c.id === event.active.id);
    const target = event.over?.id as Column | undefined;
    if (!card || !target || columnOf(card.stage) === target) return;
    move(card, target === "CLOSED" ? "REJECTED" : target);
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map((column) => {
            const inColumn = optimistic.filter((c) => columnOf(c.stage) === column);
            return (
              <StageColumn key={column} column={column} count={inColumn.length}>
                {inColumn.map((card) => (
                  <DraggableCard key={card.id} card={card} canManage={canManage} onMove={move} />
                ))}
              </StageColumn>
            );
          })}
        </div>
      </DndContext>

      <Dialog open={closing !== null} onOpenChange={(open) => !open && setClosing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {closing?.stage === "WITHDRAWN" ? "Mark as withdrawn" : "Reject"} {closing?.card.name}?
            </DialogTitle>
            <DialogDescription>The application will move out of the active pipeline.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="close-reason">Reason (optional)</Label>
            <Textarea id="close-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosing(null)}>
              Cancel
            </Button>
            <Button
              variant={closing?.stage === "REJECTED" ? "destructive" : "default"}
              onClick={() => {
                if (closing) commit(closing.card, closing.stage, reason);
                setClosing(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
