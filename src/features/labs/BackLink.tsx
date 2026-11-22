import React from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { space } from '@/ui/tokens';

/** The "‹ Back" row the pushed screens share. */
export function BackLink({ label = 'Back', onPress }: { label?: string; onPress?: () => void }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
      hitSlop={12}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.m, minHeight: 48 }}
    >
      <Icon name="chevron-left" size={18} />
      <Text variant="body" color="textSecondary" style={{ marginLeft: space.xs }}>
        {label}
      </Text>
    </Pressable>
  );
}
