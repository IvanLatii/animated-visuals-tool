import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Скасування й повтор для одного значення (проєкту). Зберігає до `limit` кроків.
 * Швидкі зміни підряд (тягнеш повзунок, мишу, друкуєш) зливаються в один крок: нова пауза понад 0.5 с починає новий.
 */
export function useHistory<T>(value: T, apply: (v: T) => void, limit = 10) {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const prev = useRef(value);
  const lastChange = useRef(0);
  const skip = useRef(false); // щойно застосували undo/redo — це не нова зміна
  const [counts, setCounts] = useState({ undo: 0, redo: 0 });
  const sync = useCallback(() => setCounts({ undo: past.current.length, redo: future.current.length }), []);

  useEffect(() => {
    if (skip.current) { skip.current = false; prev.current = value; return; }
    if (value === prev.current) return;
    const now = performance.now();
    if (now - lastChange.current > 500) {
      past.current.push(prev.current);
      if (past.current.length > limit) past.current.shift();
      future.current = [];
    }
    lastChange.current = now;
    prev.current = value;
    sync();
  }, [value, limit, sync]);

  const undo = useCallback(() => {
    const p = past.current.pop();
    if (p === undefined) return;
    future.current.push(prev.current);
    skip.current = true;
    apply(p);
    sync();
  }, [apply, sync]);

  const redo = useCallback(() => {
    const n = future.current.pop();
    if (n === undefined) return;
    past.current.push(prev.current);
    skip.current = true;
    apply(n);
    sync();
  }, [apply, sync]);

  return { undo, redo, canUndo: counts.undo > 0, canRedo: counts.redo > 0 };
}
