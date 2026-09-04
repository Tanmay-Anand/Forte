import React from 'react';
import {
  View,
  ScrollView,
  Pressable,
  useWindowDimensions,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { useTheme } from './theme';
import { gutter, radius, space, HIT, NAV } from './tokens';

/** Responsive gutter — DESIGN.md 8. Interaction model never changes, only density. */
export function useGutter(): number {
  const { width } = useWindowDimensions();
  if (width >= 1024) return gutter.desktop;
  if (width >= 600) return gutter.tablet;
  return gutter.mobile;
}

export function useBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 'desktop';
  if (width >= 600) return 'tablet';
  return 'mobile';
}

export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
  edges = ['top'],
  /** Screens inside the tab stack must clear the floating pill nav. */
  navClearance = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom')[];
  navClearance?: boolean;
}) {
  const { c } = useTheme();
  const g = useGutter();
  const body = (
    <View style={[{ paddingHorizontal: g, maxWidth: 1100, width: '100%', alignSelf: 'center' }, contentStyle]}>
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: c.bgBase }, style]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: navClearance ? NAV.clearance + space.xl : space.xxxl,
          }}
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

/** 1px tone divider. Depth comes from hairlines, never shadows (DESIGN.md 3.4). */
export function Divider({ style, inset = 0 }: { style?: StyleProp<ViewStyle>; inset?: number }) {
  const { c } = useTheme();
  return (
    <View
      style={[{ height: 1, backgroundColor: c.hairline, marginLeft: inset }, style]}
      accessibilityElementsHidden
    />
  );
}

export function Spacer({ h = space.l }: { h?: number }) {
  return <View style={{ height: h }} />;
}

/** Uppercase section label with an optional right-hand value. */
export function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: space.s,
      }}
    >
      <Text variant="label" color="textSecondary">
        {children}
      </Text>
      {right ? (
        <Text variant="label" color="textTertiary">
          {right}
        </Text>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  dashed,
  muted,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  dashed?: boolean;
  muted?: boolean;
}) {
  const { c } = useTheme();
  const base: ViewStyle = {
    backgroundColor: muted && !dashed ? c.bgSunken : dashed ? 'transparent' : c.bgRaised,
    borderRadius: radius.card,
    borderWidth: dashed ? 1 : 0,
    borderStyle: dashed ? 'dashed' : 'solid',
    borderColor: c.lineStrong,
    padding: space.l,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [base, { opacity: pressed ? 0.75 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}

/** Two-column stat grid used on Today, Summary and Progress. */
export function StatGrid({
  items,
  columns = 2,
}: {
  items: { label: string; value: string; tone?: 'positive' | 'negative' | 'default' }[];
  columns?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{ width: `${100 / columns}%`, marginBottom: space.l, paddingRight: space.s }}
        >
          <Text variant="label" color="textSecondary">
            {item.label}
          </Text>
          <Text
            variant="displayM"
            color={
              item.tone === 'positive'
                ? 'positive'
                : item.tone === 'negative'
                  ? 'negative'
                  : 'textPrimary'
            }
            style={{ marginTop: space.xs }}
          >
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Icon-sized pressable with a guaranteed 48dp target (DESIGN.md 9). */
export function IconButton({
  children,
  onPress,
  label,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        {
          minWidth: HIT,
          minHeight: HIT,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

/**
 * Empty state — DESIGN.md 6. One sentence of context, one of guidance, one
 * action. No illustrations.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ paddingVertical: space.xl }}>
      {/* An empty title would still occupy a line box and open a dead gap. */}
      {title ? <Text variant="titleM">{title}</Text> : null}
      {body ? (
        <Text
          variant="body"
          color="textSecondary"
          style={{ marginTop: title ? space.s : 0, maxWidth: 380 }}
        >
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: space.xl }}>{action}</View> : null}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: space.l,
        height: 38,
        justifyContent: 'center',
        borderRadius: radius.pill,
        marginRight: space.s,
        backgroundColor: active ? c.accent : c.bgRaised,
      }}
    >
      <Text variant="caption" color={active ? 'accentInk' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Small bordered action, for controls that sit beside a primary button.
 *
 * Bare tinted text reads as a caption, not a control — during a workout these
 * were being missed entirely. A visible border and a real pressed state make
 * them look like the buttons they are, without competing with the full-width
 * primary action below.
 */
export function ControlChip({
  label,
  onPress,
  icon,
  iconSide = 'left',
  tone = 'default',
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  iconSide?: 'left' | 'right';
  tone?: 'default' | 'accent';
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const ink = tone === 'accent' ? 'textPrimary' : 'textSecondary';
  const glyph = icon ? <Icon name={icon} size={14} color={ink} /> : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space.m,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: tone === 'accent' ? c.lineStrong : c.hairline,
        backgroundColor: pressed ? c.bgElevated : c.bgRaised,
        opacity: disabled ? 0.35 : 1,
      })}
    >
      {iconSide === 'left' ? glyph : null}
      <Text
        variant="caption"
        color={ink}
        style={{
          marginLeft: glyph && iconSide === 'left' ? space.xs : 0,
          marginRight: glyph && iconSide === 'right' ? space.xs : 0,
        }}
      >
        {label}
      </Text>
      {iconSide === 'right' ? glyph : null}
    </Pressable>
  );
}

/** Segmented control for the Progress metric switch. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: c.bgSunken,
        borderRadius: radius.pill,
        padding: 4,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              height: 40,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? c.accent : 'transparent',
            }}
          >
            <Text variant="caption" color={active ? 'accentInk' : 'textSecondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
