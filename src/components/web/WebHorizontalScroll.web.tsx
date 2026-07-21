import { useRef, useEffect, type ReactNode, type CSSProperties, type MouseEvent } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import {
  flattenViewStyle,
  type WebDragScrollHandlers,
} from '@/lib/web-style-utils';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('[role="button"], button, a, input, textarea, select, label'));
}

function useDragScrollHandlers(scrollRef: React.RefObject<HTMLDivElement | null>): WebDragScrollHandlers {
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });

  const onMouseDown = (e: MouseEvent) => {
    if (isInteractiveTarget(e.target)) return;
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    dragRef.current = { active: true, startX: e.clientX, scrollLeft: el.scrollLeft };
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  };

  const endDrag = () => {
    const el = scrollRef.current;
    dragRef.current.active = false;
    if (!el) return;
    el.style.cursor = 'grab';
    el.style.userSelect = '';
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragRef.current.active) return;
    const el = scrollRef.current;
    if (!el) return;
    e.preventDefault();
    const dx = e.clientX - dragRef.current.startX;
    el.scrollLeft = dragRef.current.scrollLeft - dx;
  };

  return { onMouseDown, onMouseUp: endDrag, onMouseLeave: endDrag, onMouseMove };
}

/** Web — horizontal scroll with mouse wheel + click-drag (OfferUp-style category strip). */
export function WebHorizontalScroll({
  children,
  style,
  contentContainerStyle,
  testID,
}: Props): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const drag = useDragScrollHandlers(scrollRef);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      e.preventDefault();
      el.scrollLeft += delta;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const outer = flattenViewStyle(style) as CSSProperties;
  const inner = flattenViewStyle(contentContainerStyle) as CSSProperties;

  return (
    <div
      ref={scrollRef}
      data-testid={testID}
      style={{
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        cursor: 'grab',
        scrollbarWidth: 'thin',
        touchAction: 'pan-x',
        ...outer,
      }}
      onMouseDown={drag.onMouseDown}
      onMouseUp={drag.onMouseUp}
      onMouseLeave={drag.onMouseLeave}
      onMouseMove={drag.onMouseMove}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          width: 'max-content',
          minWidth: '100%',
          ...inner,
        }}
      >
        {children}
      </div>
    </div>
  );
}
