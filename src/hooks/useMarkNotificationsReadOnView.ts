import { useCallback, useEffect, useRef, useState } from 'react';

type MarkReadFn = (notificationId: string) => Promise<unknown>;

/** Tracks notifications seen on Activity; marks them read only when the user leaves. */
export function useMarkNotificationsReadOnView(
  enabled: boolean,
  markRead: MarkReadFn
) {
  const seenIdsRef = useRef(new Set<string>());
  const committedIdsRef = useRef(new Set<string>());
  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;
  const [visibilityTick, setVisibilityTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    seenIdsRef.current.clear();
  }, [enabled]);

  const commitSeenAsRead = useCallback(() => {
    const ids = [...seenIdsRef.current].filter((id) => !committedIdsRef.current.has(id));
    seenIdsRef.current.clear();
    if (ids.length === 0) return;

    ids.forEach((id) => committedIdsRef.current.add(id));
    void Promise.all(
      ids.map((id) =>
        markReadRef.current(id).catch(() => {
          committedIdsRef.current.delete(id);
        })
      )
    );
  }, []);

  const markVisible = useCallback(
    (notificationId: string) => {
      if (!enabled || committedIdsRef.current.has(notificationId)) return;
      seenIdsRef.current.add(notificationId);
    },
    [enabled]
  );

  const notifyScroll = useCallback(() => {
    setVisibilityTick((n) => n + 1);
  }, []);

  return { markVisible, visibilityTick, notifyScroll, flushOnLeave: commitSeenAsRead };
}
