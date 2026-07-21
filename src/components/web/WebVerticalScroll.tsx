import { type ReactNode } from 'react';
import {
  ScrollView,
  type StyleProp,
  type ViewStyle,
  type ScrollViewProps,
} from 'react-native';

type Props = ScrollViewProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Native — standard vertical ScrollView. */
export function WebVerticalScroll({
  children,
  style,
  contentContainerStyle,
  testID,
  ...rest
}: Props): React.JSX.Element {
  return (
    <ScrollView
      style={style}
      contentContainerStyle={contentContainerStyle}
      testID={testID}
      showsVerticalScrollIndicator
      nestedScrollEnabled
      {...rest}
    >
      {children}
    </ScrollView>
  );
}
