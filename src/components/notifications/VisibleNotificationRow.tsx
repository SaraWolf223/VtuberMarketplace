import { useCallback, useEffect, useRef } from 'react';
import { Dimensions, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationRow } from '@/components/notifications/NotificationRow';
import type { NotificationRow as Row } from '@/types/notifications';

type Props = {
  item: Row;
  onPress: () => void;
  onVisible: (notificationId: string) => void;
  visibilityTick: number;
  active: boolean;
};

const HEADER_AND_TOOLBAR_ESTIMATE = 112;
const TAB_BAR_ESTIMATE = 56;

export function VisibleNotificationRow({
  item,
  onPress,
  onVisible,
  visibilityTick,
  active,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const ref = useRef<View>(null);
  const sentRef = useRef(!!item.read_at);

  useEffect(() => {
    sentRef.current = !!item.read_at;
  }, [item.id, item.read_at]);

  useEffect(() => {
    if (!active) {
      sentRef.current = !!item.read_at;
    }
  }, [active, item.read_at]);

  const checkVisible = useCallback(() => {
    if (!active || item.read_at || sentRef.current) return;

    ref.current?.measureInWindow((_x, y, _width, height) => {
      if (item.read_at || sentRef.current) return;

      const windowHeight = Dimensions.get('window').height;
      const top = insets.top + HEADER_AND_TOOLBAR_ESTIMATE;
      const bottom = windowHeight - insets.bottom - TAB_BAR_ESTIMATE;
      const itemTop = y;
      const itemBottom = y + height;

      if (itemBottom > top + 8 && itemTop < bottom - 8) {
        sentRef.current = true;
        onVisible(item.id);
      }
    });
  }, [active, insets.bottom, insets.top, item.id, item.read_at, onVisible]);

  useEffect(() => {
    checkVisible();
  }, [checkVisible, visibilityTick]);

  const onLayout = (_event: LayoutChangeEvent) => {
    checkVisible();
  };

  return (
    <View ref={ref} onLayout={onLayout} collapsable={false}>
      <NotificationRow item={item} onPress={onPress} />
    </View>
  );
}
