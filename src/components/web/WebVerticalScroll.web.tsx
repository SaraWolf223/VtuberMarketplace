import { useRef, useEffect, type ReactNode, type CSSProperties, type MouseEvent } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { flattenViewStyle } from '@/lib/web-style-utils';

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

/** Web — vertical scroll panel with wheel + click-drag (filters sheet body). */
export function WebVerticalScroll({
  children,
  style,
  contentContainerStyle,
  testID,
}: Props): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ active: false, startY: 0, scrollTop: 0 });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (el.scrollHeight <= el.clientHeight) return;
      e.stopPropagation();
    };

    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(e.target)) return;
    const el = scrollRef.current;
    if (!el || el.scrollHeight <= el.clientHeight) return;
    dragRef.current = { active: true, startY: e.clientY, scrollTop: el.scrollTop };
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

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const el = scrollRef.current;
    if (!el) return;
    e.preventDefault();
    const dy = e.clientY - dragRef.current.startY;
    el.scrollTop = dragRef.current.scrollTop - dy;
  };

  const outer = flattenViewStyle(style) as CSSProperties;
  const inner = flattenViewStyle(contentContainerStyle) as CSSProperties;

  return (
    <div
      ref={scrollRef}
      data-testid={testID}
      style={{
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        cursor: 'grab',
        scrollbarWidth: 'thin',
        touchAction: 'pan-y',
        ...outer,
      }}
      onMouseDown={onMouseDown}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onMouseMove={onMouseMove}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          ...inner,
        }}
      >
        {children}
      </div>
    </div>
  );
}
