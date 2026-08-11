"use client";

import { useRef, useState } from "react";

/*
 * Drag-and-drop ordering for one flat list, shared by taxonomy admin and
 * the skills editor. Keyboard path: callers render move up/down buttons
 * wired to `nudge`. Server data changing underneath is adopted via
 * render-time state sync; the ref is only ever touched in drag handlers.
 */
export function useDragOrder(ids: string[], commit: (ids: string[]) => void) {
  const [order, setOrder] = useState(ids);
  const key = ids.join("\n");
  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    setOrder(ids);
  }
  const from = useRef<number | null>(null);

  const arrange = (list: string[], fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= list.length) return list;
    const next = [...list];
    const [id] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, id);
    return next;
  };

  return {
    order,
    onDragStart: (index: number) => {
      from.current = index;
    },
    onDragOver: (index: number) => {
      const f = from.current;
      if (f !== null && f !== index) {
        setOrder((prev) => arrange(prev, f, index));
        from.current = index;
      }
    },
    onDragEnd: () => {
      from.current = null;
      // Handlers are re-bound every render, so `order` here is current.
      if (order.join("\n") !== key) commit(order);
    },
    nudge: (index: number, delta: number) => {
      const next = arrange(order, index, index + delta);
      if (next.join("\n") !== key) {
        setOrder(next);
        commit(next);
      }
    },
  };
}
