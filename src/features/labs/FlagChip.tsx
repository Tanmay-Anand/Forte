import React from 'react';
import { View } from 'react-native';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';

/**
 * "Above range" / "Below range". Outlined and neutral, not red: it states
 * where a value sits against the lab's own range, which is arithmetic, not a
 * judgement. The words carry the meaning, so colour is never the only cue.
 */
export function FlagChip({ label }: { label: string }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: c.textSecondary,
        borderRadius: radius.pill,
        paddingHorizontal: space.s,
        paddingVertical: 2,
      }}
    >
      <Text variant="caption" color="textPrimary">
        {label}
      </Text>
    </View>
  );
}
