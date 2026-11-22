import React, { useState } from 'react';
import { View, Pressable, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, useTextStyle } from '@/ui/Text';
import { Icon } from '@/ui/Icon';
import { NavRow } from '@/ui/NavRow';
import { Screen, SectionLabel, Segmented, Spacer } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { ageYears, getProfile, saveProfile } from '@/db/queries/profile';
import { NumericKeypad } from '@/features/workout/NumericKeypad';
import { isPlausible } from '@/features/profile/kinds';
import { formatWeight, fromDisplayWeight, toDisplayWeight, trimNumber } from '@/lib/format';
import { useSettings } from '@/store/settings';

type Sex = 'unset' | 'male' | 'female';

/**
 * Date of birth, sex and target weight. Age is worked out from the date of
 * birth each time, so it never goes stale. Sex is optional and used only as
 * context when reading lab reference ranges.
 */
export default function AboutScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { lineHeight: _lh, ...inputType } = useTextStyle('titleM');
  const unit = useSettings((s) => s.unit);
  const profile = useQuery(() => getProfile(), []);
  const [dob, setDob] = useState(profile.date_of_birth ?? '');
  const [targeting, setTargeting] = useState(false);

  const validDob = /^\d{4}-\d{2}-\d{2}$/.test(dob) && ageYears(dob) != null;
  const commitDob = () => {
    if (dob === '') saveProfile({ date_of_birth: null });
    else if (validDob) saveProfile({ date_of_birth: dob });
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Pressable
        onPress={() => {
          commitDob();
          router.back();
        }}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.m }}
      >
        <Icon name="chevron-left" size={18} />
        <Text variant="body" color="textSecondary" style={{ marginLeft: space.xs }}>
          Profile
        </Text>
      </Pressable>
      <Text variant="displayM">About you</Text>

      <Spacer h={space.xl} />
      <SectionLabel>Date of birth</SectionLabel>
      <TextInput
        value={dob}
        onChangeText={(v) => setDob(v.replace(/[^\d-]/g, '').slice(0, 10))}
        onBlur={commitDob}
        onSubmitEditing={commitDob}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={c.textTertiary}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel="Date of birth, year month day"
        style={{
          ...inputType,
          color: c.textPrimary,
          borderWidth: 1,
          borderColor: dob && !validDob ? c.negative : c.lineStrong,
          borderRadius: radius.input,
          paddingHorizontal: space.m,
          height: 52,
        }}
      />
      <Text variant="caption" color={dob && !validDob ? 'negative' : 'textTertiary'} style={{ marginTop: space.xs }}>
        {dob && !validDob
          ? 'Use the form 1998-04-21.'
          : validDob
            ? `Age ${ageYears(dob)}`
            : 'Used to give age as context in analysis. Never shared unless you allow body data.'}
      </Text>

      <Spacer h={space.xl} />
      <SectionLabel>Sex</SectionLabel>
      <Segmented<Sex>
        options={[
          { value: 'unset', label: 'Not set' },
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
        ]}
        value={profile.sex ?? 'unset'}
        onChange={(v) => saveProfile({ sex: v === 'unset' ? null : v })}
      />
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.xs }}>
        Optional. Some blood-test ranges differ by sex.
      </Text>

      <Spacer h={space.xl} />
      <SectionLabel>Goal</SectionLabel>
      <NavRow
        label="Target weight"
        value={profile.target_weight_kg != null ? formatWeight(profile.target_weight_kg, unit) : 'Add'}
        onPress={() => setTargeting(true)}
      />
      {profile.target_weight_kg != null ? (
        <View style={{ marginTop: space.s }}>
          <Pressable onPress={() => saveProfile({ target_weight_kg: null })} accessibilityRole="button" hitSlop={8}>
            <Text variant="caption" color="textSecondary">
              Remove target
            </Text>
          </Pressable>
        </View>
      ) : null}

      <NumericKeypad
        visible={targeting}
        title="Target weight"
        unit={unit}
        initial={
          profile.target_weight_kg != null
            ? Number(trimNumber(toDisplayWeight(profile.target_weight_kg, unit), 1))
            : unit === 'kg'
              ? 70
              : 155
        }
        onCancel={() => setTargeting(false)}
        onDone={(v) => {
          setTargeting(false);
          const kg = fromDisplayWeight(v, unit);
          if (isPlausible('weight', kg)) saveProfile({ target_weight_kg: kg });
          else if (v > 0) Alert.alert('Check the number', `${v} ${unit} looks like a typo. Nothing was saved.`);
        }}
      />
    </Screen>
  );
}
