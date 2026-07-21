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

/** Native — standard horizontal ScrollView. */
export function WebHorizontalScroll({
  children,
  style,
  contentContainerStyle,
  testID,
  ...rest
}: Props): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={contentContainerStyle}
      testID={testID}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}
