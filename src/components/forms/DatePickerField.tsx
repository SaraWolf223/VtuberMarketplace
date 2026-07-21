import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  StyleSheet,
  View,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buildMonthGrid,
  monthYearLabel,
  sameLocalDay,
  startOfLocalDay,
  formatLocalDateLabel,
} from '@/lib/calendar-grid';
import { spacing, radius } from '@/theme/tokens';
import { createThemedStyles } from '@/theme/useThemedStyles';
import { fontSize, fontWeight } from '@/theme/typography';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Props = {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  hint?: string;
};

export function DatePickerField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  hint,
}: Props): React.JSX.Element {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  const min = minimumDate ? startOfLocalDay(minimumDate) : undefined;
  const max = maximumDate ? startOfLocalDay(maximumDate) : undefined;

  const grid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth, min, max),
    [viewYear, viewMonth, min, max]
  );

  const openPicker = () => {
    setViewYear(value.getFullYear());
    setViewMonth(value.getMonth());
    setOpen(true);
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const selectDay = (date: Date) => {
    onChange(startOfLocalDay(date));
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.field}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatLocalDateLabel(value)}`}
      >
        <Text style={styles.fieldText}>{formatLocalDateLabel(value)}</Text>
        <Text style={styles.change}>Change</Text>
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Text style={styles.done}>Done</Text>
              </Pressable>
            </View>

            <View style={styles.monthNav}>
              <Pressable onPress={() => shiftMonth(-1)} style={styles.navBtn} hitSlop={8}>
                <Text style={styles.navBtnText}>‹</Text>
              </Pressable>
              <Text style={styles.monthLabel}>{monthYearLabel(viewYear, viewMonth)}</Text>
              <Pressable onPress={() => shiftMonth(1)} style={styles.navBtn} hitSlop={8}>
                <Text style={styles.navBtnText}>›</Text>
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((d) => (
                <Text key={d} style={styles.weekday}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {grid.map((cell) => {
                const selected = sameLocalDay(cell.date, value);
                return (
                  <Pressable
                    key={cell.date.toISOString()}
                    style={[
                      styles.dayCell,
                      !cell.inMonth && styles.dayCellOutside,
                      selected && styles.dayCellSelected,
                      cell.disabled && styles.dayCellDisabled,
                    ]}
                    disabled={cell.disabled || !cell.inMonth}
                    onPress={() => selectDay(cell.date)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !cell.inMonth && styles.dayTextOutside,
                        selected && styles.dayTextSelected,
                        cell.disabled && styles.dayTextDisabled,
                      ]}
                    >
                      {cell.date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
              {min && sameLocalDay(min, new Date()) ? (
                <Pressable
                  style={styles.quickChip}
                  onPress={() => selectDay(new Date())}
                >
                  <Text style={styles.quickChipText}>Today</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.quickChip}
                onPress={() => {
                  const t = startOfLocalDay(new Date());
                  t.setDate(t.getDate() + 1);
                  if (!max || t <= max) selectDay(t);
                }}
              >
                <Text style={styles.quickChipText}>Tomorrow</Text>
              </Pressable>
              <Pressable
                style={styles.quickChip}
                onPress={() => {
                  const t = startOfLocalDay(new Date());
                  t.setDate(t.getDate() + 7);
                  if (!max || t <= max) selectDay(t);
                }}
              >
                <Text style={styles.quickChipText}>In 1 week</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.text },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  fieldText: { fontSize: fontSize.body, color: colors.text, fontWeight: fontWeight.regular },
  change: { fontSize: fontSize.caption, color: colors.primary, fontWeight: fontWeight.semibold },
  hint: { fontSize: fontSize.caption, color: colors.textMuted, lineHeight: 18 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sheetTitle: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.text },
  done: { fontSize: fontSize.body, color: colors.primary, fontWeight: fontWeight.semibold },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  navBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  navBtnText: { fontSize: 24, color: colors.text, lineHeight: 28 },
  monthLabel: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.text },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.caption,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  dayCellOutside: { opacity: 0.35 },
  dayCellSelected: { backgroundColor: colors.primary },
  dayCellDisabled: { opacity: 0.25 },
  dayText: { fontSize: fontSize.body, color: colors.text },
  dayTextOutside: { color: colors.textMuted },
  dayTextSelected: { color: colors.onPrimary, fontWeight: fontWeight.bold },
  dayTextDisabled: { color: colors.textMuted },
  quickRow: { marginTop: spacing.md, flexGrow: 0 },
  quickChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.priceBackground,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  quickChipText: { fontSize: fontSize.caption, color: colors.primary, fontWeight: fontWeight.semibold },
}));
