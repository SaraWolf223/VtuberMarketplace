import { TextInput, type TextInputProps } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useThemedInputStyles } from '@/theme/useThemedInputStyles';

type Props = TextInputProps;

/** TextInput with theme-aware text, surface, and placeholder colors. */
export function ThemedTextInput({
  style,
  placeholderTextColor,
  ...rest
}: Props): React.JSX.Element {
  const colors = useThemeColors();
  const inputStyles = useThemedInputStyles();

  return (
    <TextInput
      style={[inputStyles.input, style]}
      placeholderTextColor={placeholderTextColor ?? colors.textMuted}
      selectionColor={colors.primary}
      cursorColor={colors.primary}
      {...rest}
    />
  );
}
