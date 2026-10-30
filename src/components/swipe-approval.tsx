"use client";

import { useRef, useState } from "react";

export function SwipeApproval({
  disabled,
  onApprove,
  onReject,
  children,
}: {
  disabled?: boolean;
  onApprove: () => void;
  onReject: () => void;
  children: React.ReactNode;
}) {
  const startX = useRef<number | null>(null);
  const dx = useRef(0);
  const [shift, setShift] = useState(0);
  const [dragging, setDragging] = useState(false);

  function reset() {
    startX.current = null;
    dx.current = 0;
    setDragging(false);
    setShift(0);
  }

  return (
    <div className="relative overflow-hidden rounded-3xl">
      <div className="pointer-events-none absolute inset-0 flex text-sm font-medium" aria-hidden>
        <div className="flex flex-1 items-center bg-primary/25 pl-4 text-primary">Goedkeuren</div>
        <div className="flex flex-1 items-center justify-end bg-destructive/20 pr-4 text-destructive">Afwijzen</div>
      </div>
      <div
        className="relative touch-pan-y bg-card"
        style={{ transform: `translateX(${shift}px)`, transition: dragging ? "none" : "transform 180ms ease" }}
        onPointerDown={(event) => {
          if (disabled) return;
          const target = event.target as HTMLElement;
          if (target.closest("button, a, input, textarea, select, label")) return;
          startX.current = event.clientX;
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (startX.current == null) return;
          const next = Math.max(-140, Math.min(140, event.clientX - startX.current));
          dx.current = next;
          setShift(next);
        }}
        onPointerUp={() => {
          if (dx.current > 88) onApprove();
          else if (dx.current < -88) onReject();
          reset();
        }}
        onPointerCancel={reset}
      >
        {children}
      </div>
    </div>
  );
}
