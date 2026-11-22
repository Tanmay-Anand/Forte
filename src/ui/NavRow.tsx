import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from './Text';
import { Icon } from './Icon';
import { useTheme } from './theme';
import { space } from './tokens';

/**
 * A list row that opens something: label, optional secondary line, value on
 * the right, chevron. Hairline below, no card — the Settings list pattern.
 */
export function NavRow({
  label,
  sub,
  value,
  onPress,
  tone = 'default',
}: {
  label: string;
  sub?: string;
  value?: string;
  onPress: () => void;
  tone?: 'default' | 'negative';
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[label, value, sub].filter(Boolean).join(', ')}
      style={({ pressed }) => ({
        minHeight: sub ? 60 : 52,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderColor: c.hairline,
        paddingVertical: space.s,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, paddingRight: space.m }}>
        <Text variant="body" color={tone === 'negative' ? 'negative' : 'textPrimary'}>
          {label}
        </Text>
        {sub ? (
          <Text variant="caption" color="textTertiary">
            {sub}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="num" color="textSecondary" style={{ marginRight: space.s }}>
          {value}
        </Text>
      ) : null}
      {tone === 'default' ? <Icon name="chevron-right" size={16} color="textTertiary" /> : null}
    </Pressable>
  );
}
