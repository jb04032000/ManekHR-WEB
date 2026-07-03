/**
 * Shop Floor - one zoom/pan/drag engine for every SVG canvas.
 *
 * What: manages an SVG viewBox (wheel zoom at pointer, background pan,
 * +/−/fit buttons) and optional element dragging for nodes marked with
 * `data-drag="<key>"`. Ported from the shop-floor prototype's ZB engine into
 * a per-instance React hook.
 *
 * Links: used by FloorView / ProcessView and the network canvases in
 * CpmView / PertView (components/machines/shop-floor).
 *
 * Watch: views render their scene as an SVG markup string - the hook only
 * reads `data-drag` / `data-skip-pan` attributes off event targets, so keep
 * those attribute names in sync with the view renderers. The svg element is
 * tracked via a callback ref (it may mount late behind empty states); refs
 * are synced in effects, never during render (react-hooks/refs).
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Content base size - reset target. */
  W: number;
  H: number;
}

export interface SvgCanvasOptions {
  /** When true, `data-drag` elements move instead of panning. */
  unlocked?: boolean;
  /** Current position of a draggable element (svg coords). */
  getPos?: (key: string) => { x: number; y: number } | null;
  /** Live position update while dragging (views re-render their scene). */
  onDragMove?: (key: string, x: number, y: number) => void;
  /** Drag finished - persist the position. */
  onDragEnd?: (key: string, x: number, y: number) => void;
}

export function useSvgCanvas(opts: SvgCanvasOptions = {}) {
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  /** Callback ref - the canvases mount/unmount behind empty states. */
  const svgRef = useCallback((el: SVGSVGElement | null) => {
    setSvgEl(el);
  }, []);

  const [vb, setVb] = useState<ViewBox | null>(null);
  const vbRef = useRef<ViewBox | null>(null);
  useEffect(() => {
    vbRef.current = vb;
  }, [vb]);

  // Fresh options for window-level pointer handlers without rebinding.
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  const drag = useRef<
    | { kind: 'pan'; sx: number; sy: number; zx: number; zy: number }
    | {
        kind: 'el';
        key: string;
        offX: number;
        offY: number;
        lastX: number;
        lastY: number;
        moved: boolean;
      }
    | null
  >(null);

  /** Declare the content size; resets the view when not zoomed in. */
  const setBase = useCallback((W: number, H: number) => {
    setVb((prev) => {
      if (!prev) return { x: 0, y: 0, w: W, h: H, W, H };
      const fresh = Math.abs(prev.W - W) > 1 || Math.abs(prev.H - H) > 1;
      if (fresh && prev.w >= prev.W * 0.99) return { x: 0, y: 0, w: W, h: H, W, H };
      if (fresh) return { ...prev, W, H };
      return prev;
    });
  }, []);

  const reset = useCallback(() => {
    setVb((prev) => (prev ? { ...prev, x: 0, y: 0, w: prev.W, h: prev.H } : prev));
  }, []);

  const zoomAt = useCallback((f: number, ax?: number, ay?: number) => {
    setVb((prev) => {
      if (!prev) return prev;
      const cx = ax ?? prev.x + prev.w / 2;
      const cy = ay ?? prev.y + prev.h / 2;
      const nw = Math.max(prev.W / 10, Math.min(prev.W * 3, prev.w * f));
      const k = nw / prev.w;
      return {
        ...prev,
        x: cx - (cx - prev.x) * k,
        y: cy - (cy - prev.y) * k,
        w: nw,
        h: prev.h * k,
      };
    });
  }, []);

  const svgPoint = useCallback(
    (e: { clientX: number; clientY: number }) => {
      if (!svgEl) return { x: 0, y: 0 };
      const pt = svgEl.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const m = svgEl.getScreenCTM();
      const p = m ? pt.matrixTransform(m.inverse()) : pt;
      return { x: p.x, y: p.y };
    },
    [svgEl],
  );

  // Wheel zoom - must be a non-passive native listener to preventDefault.
  useEffect(() => {
    if (!svgEl) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = svgPoint(e);
      zoomAt(e.deltaY > 0 ? 1.13 : 0.885, p.x, p.y);
    };
    svgEl.addEventListener('wheel', onWheel, { passive: false });
    return () => svgEl.removeEventListener('wheel', onWheel);
  }, [svgEl, svgPoint, zoomAt]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const target = e.target as Element;
      if (target.closest('[data-skip-pan]')) return; // ports/edges stay click-only
      const dragEl = target.closest('[data-drag]');
      const o = optsRef.current;
      if (dragEl && o.unlocked && o.getPos) {
        const key = dragEl.getAttribute('data-drag')!;
        const pos = o.getPos(key);
        if (pos) {
          const p = svgPoint(e);
          drag.current = {
            kind: 'el',
            key,
            offX: p.x - pos.x,
            offY: p.y - pos.y,
            lastX: pos.x,
            lastY: pos.y,
            moved: false,
          };
          e.preventDefault();
          return;
        }
      }
      const z = vbRef.current;
      if (!z) return;
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, zx: z.x, zy: z.y };
      svgEl?.classList.add('sf-dragging');
    },
    [svgPoint, svgEl],
  );

  useEffect(() => {
    if (!svgEl) return;
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (d.kind === 'pan') {
        const z = vbRef.current;
        if (!z) return;
        const r = svgEl.getBoundingClientRect();
        setVb({
          ...z,
          x: d.zx - ((e.clientX - d.sx) * z.w) / r.width,
          y: d.zy - ((e.clientY - d.sy) * z.h) / r.height,
        });
      } else {
        const p = svgPoint(e);
        d.lastX = Math.round(p.x - d.offX);
        d.lastY = Math.round(p.y - d.offY);
        d.moved = true;
        optsRef.current.onDragMove?.(d.key, d.lastX, d.lastY);
      }
    };
    const onUp = () => {
      const d = drag.current;
      svgEl.classList.remove('sf-dragging');
      if (d?.kind === 'el' && d.moved) {
        optsRef.current.onDragEnd?.(d.key, d.lastX, d.lastY);
      }
      drag.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [svgEl, svgPoint]);

  const viewBox = vb ? `${vb.x} ${vb.y} ${vb.w} ${vb.h}` : '0 0 100 100';

  return { svgRef, viewBox, setBase, reset, zoomAt, svgPoint, onPointerDown };
}

export type SvgCanvas = ReturnType<typeof useSvgCanvas>;
