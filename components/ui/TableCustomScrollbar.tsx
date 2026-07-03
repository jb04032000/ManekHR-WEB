'use client';

import { useEffect, useRef } from 'react';

/**
 * TableCustomScrollbar - a branded, fully-custom horizontal scrollbar for an
 * AntD table (or any horizontally-scrolling container). Native scrollbar
 * styling is unreliable across browsers/OS, so the native bar is hidden (see
 * the `.team-table-wrap .ant-table-content` rule in globals.css) and this draws
 * its own draggable thumb synced to the container's scrollLeft. It also turns a
 * plain vertical wheel into horizontal scroll (no shift needed).
 *
 * Robust to the AntD structure: the real scroller (`.ant-table-content`) mounts
 * AFTER this renders and can be recreated when data/columns change, so we locate
 * and re-bind it via a MutationObserver instead of a fixed ref. Cross-links:
 * Team table (app/(app)/dashboard/team/page.tsx).
 */
export function TableCustomScrollbar({
  containerRef,
  scrollSelector = '.ant-table-content',
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  scrollSelector?: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = containerRef.current;
    const bar = barRef.current;
    const thumb = thumbRef.current;
    if (!root || !bar || !thumb) return;

    let content: HTMLElement | null = null;

    // Recompute thumb size + position (and hide the bar when there's no overflow).
    const sync = () => {
      if (!content) {
        bar.style.display = 'none';
        return;
      }
      const ratio = content.clientWidth / content.scrollWidth;
      if (!(ratio < 1)) {
        bar.style.display = 'none';
        return;
      }
      bar.style.display = 'block';
      const barW = bar.clientWidth;
      const thumbW = Math.max(48, barW * ratio);
      thumb.style.width = `${thumbW}px`;
      const maxScroll = content.scrollWidth - content.clientWidth;
      const maxThumb = barW - thumbW;
      thumb.style.transform = `translateX(${maxScroll > 0 ? (content.scrollLeft / maxScroll) * maxThumb : 0}px)`;
    };

    // Plain vertical wheel -> horizontal scroll; passes through at the edges so
    // the page can still scroll vertically past the table.
    const onWheel = (e: WheelEvent) => {
      if (!content || e.deltaY === 0 || e.shiftKey) return;
      if (content.scrollWidth <= content.clientWidth) return;
      const atStart = content.scrollLeft <= 0;
      const atEnd = Math.ceil(content.scrollLeft + content.clientWidth) >= content.scrollWidth;
      if ((atStart && e.deltaY < 0) || (atEnd && e.deltaY > 0)) return;
      e.preventDefault();
      content.scrollLeft += e.deltaY;
    };

    const bind = (el: HTMLElement) => {
      el.addEventListener('scroll', sync, { passive: true });
      el.addEventListener('wheel', onWheel, { passive: false });
    };
    const unbind = (el: HTMLElement) => {
      el.removeEventListener('scroll', sync);
      el.removeEventListener('wheel', onWheel);
    };

    const ro = new ResizeObserver(sync);
    ro.observe(root);

    // (Re)locate the scroller and move listeners onto it when it appears/changes.
    const pickContent = () => {
      const next = root.querySelector<HTMLElement>(scrollSelector);
      if (next === content) return;
      if (content) {
        unbind(content);
        ro.unobserve(content);
      }
      content = next;
      if (content) {
        bind(content);
        ro.observe(content);
      }
      sync();
    };

    // Thumb drag.
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    const down = (e: MouseEvent) => {
      if (!content) return;
      dragging = true;
      startX = e.clientX;
      startScroll = content.scrollLeft;
      e.preventDefault();
    };
    const move = (e: MouseEvent) => {
      if (!dragging || !content) return;
      const maxThumb = bar.clientWidth - thumb.clientWidth;
      const maxScroll = content.scrollWidth - content.clientWidth;
      content.scrollLeft =
        startScroll + (maxThumb > 0 ? ((e.clientX - startX) / maxThumb) * maxScroll : 0);
    };
    const up = () => {
      dragging = false;
    };

    thumb.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('resize', sync);

    const mo = new MutationObserver(pickContent);
    mo.observe(root, { childList: true, subtree: true });
    pickContent();

    return () => {
      thumb.removeEventListener('mousedown', down);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('resize', sync);
      if (content) unbind(content);
      ro.disconnect();
      mo.disconnect();
    };
  }, [containerRef, scrollSelector]);

  return (
    <div ref={barRef} className="cr-scrollbar" style={{ display: 'none' }} aria-hidden>
      <div ref={thumbRef} className="cr-scrollbar__thumb" />
    </div>
  );
}

export default TableCustomScrollbar;
