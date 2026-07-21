import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

export function flattenViewStyle(style?: StyleProp<ViewStyle>): ViewStyle {
  return StyleSheet.flatten(style) ?? {};
}

export type WebDragScrollHandlers = {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onMouseMove: (e: React.MouseEvent) => void;
};
