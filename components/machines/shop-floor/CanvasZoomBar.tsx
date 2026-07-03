/**
 * Shop Floor - zoom + fullscreen overlay buttons for the SVG canvases.
 * Links: pairs with useSvgCanvas (FloorView / ProcessView / Cpm / Pert).
 * Fullscreen uses the native Fullscreen API on the .sf-canvas-wrap element
 * (CSS `:fullscreen` rules in page.tsx stretch the svg to the viewport).
 */

'use client';

import { FullscreenOutlined } from '@ant-design/icons';
import type { SvgCanvas } from './useSvgCanvas';

export function CanvasZoomBar({
  canvas,
  fullscreenTarget,
}: {
  canvas: SvgCanvas;
  /** Element sent fullscreen (the canvas wrapper). Omit to hide the button. */
  fullscreenTarget?: React.RefObject<HTMLDivElement | null>;
}) {
  const toggleFullscreen = () => {
    const el = fullscreenTarget?.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  };

  return (
    <div className="sf-zoombar">
      <button type="button" aria-label="Zoom in" onClick={() => canvas.zoomAt(0.8)}>
        ＋
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => canvas.zoomAt(1.25)}>
        −
      </button>
      <button type="button" aria-label="Fit to view" onClick={() => canvas.reset()}>
        ⛶
      </button>
      {fullscreenTarget && (
        <button type="button" aria-label="Toggle full screen" onClick={toggleFullscreen}>
          <FullscreenOutlined />
        </button>
      )}
    </div>
  );
}
