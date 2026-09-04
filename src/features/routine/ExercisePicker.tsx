import React, { useState } from 'react';
import { Modal, View, TextInput, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';
import { Chip, Divider, IconButton, SectionLabel } from '@/ui/primitives';
import { radius, space } from '@/ui/tokens';
import { useQuery } from '@/lib/db-hooks';
import { createExercise, recentExercises, searchExercises } from '@/db/queries/routine';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/data/exercises.seed';

/**
 * Exercise library sheet — DESIGN.md 5.3.
 * Stays open after each add because multi-add is the common case; recents rank
 * above alphabetical because the user's own history is the best predictor.
 */
export function ExercisePicker({
  visible,
  onClose,
  onAdd,
  title = 'Add Exercise',
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (exerciseId: string) => void;
  title?: string;
}) {
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all');
  const [added, setAdded] = useState(0);

  const results = useQuery(() => searchExercises(query, group), [query, group]);
  const recents = useQuery(() => recentExercises(6), []);

  const exactMatch = results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase());
  const canCreate = query.trim().length > 1 && !exactMatch;

  const add = (id: string) => {
    onAdd(id);
    setAdded((n) => n + 1);
  };

  const close = () => {
    setQuery('');
    setGroup('all');
    setAdded(0);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bgBase }} edges={['top', 'bottom']}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: space.l,
            paddingVertical: space.s,
          }}
        >
          <Text variant="titleM">{title}</Text>
          <Pressable onPress={close} accessibilityRole="button" hitSlop={12}>
            <Text variant="bodyStrong" color={added > 0 ? 'accent' : 'textSecondary'}>
              {added > 0 ? `Done · ${added} added` : 'Close'}
            </Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: space.l }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises"
            placeholderTextColor={c.textTertiary}
            autoFocus
            style={{
              height: 52,
              borderRadius: radius.input,
              borderWidth: 1,
              borderColor: c.lineStrong,
              backgroundColor: c.bgSunken,
              color: c.textPrimary,
              paddingHorizontal: space.m,
              fontSize: 16,
            }}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: space.m, flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: space.l }}
        >
          <Chip label="All" active={group === 'all'} onPress={() => setGroup('all')} />
          {MUSCLE_GROUPS.map((g) => (
            <Chip
              key={g}
              label={g[0]!.toUpperCase() + g.slice(1)}
              active={group === g}
              onPress={() => setGroup(g)}
            />
          ))}
        </ScrollView>

        <ScrollView
          style={{ flex: 1, marginTop: space.l }}
          contentContainerStyle={{ paddingHorizontal: space.l, paddingBottom: space.xxxl }}
          keyboardShouldPersistTaps="handled"
        >
          {query === '' && group === 'all' && recents.length > 0 ? (
            <>
              <SectionLabel>Recent</SectionLabel>
              {recents.map((e) => (
                <Row key={e.id} name={e.name} meta={e.equipment} onAdd={() => add(e.id)} />
              ))}
              <Divider style={{ marginVertical: space.l }} />
            </>
          ) : null}

          <SectionLabel right={`${results.length}`}>
            {group === 'all' ? 'All exercises' : group}
          </SectionLabel>
          {results.map((e) => (
            <Row key={e.id} name={e.name} meta={e.equipment} onAdd={() => add(e.id)} />
          ))}

          {results.length === 0 && !canCreate ? (
            <Text variant="body" color="textSecondary" style={{ paddingVertical: space.l }}>
              No exercise matches “{query}”.
            </Text>
          ) : null}

          {canCreate ? (
            <Pressable
              onPress={() => {
                const id = createExercise(query, 'other', group === 'all' ? 'full' : group);
                if (id) {
                  add(id);
                  setQuery('');
                }
              }}
              style={{ paddingVertical: space.l }}
              accessibilityRole="button"
            >
              <Text variant="bodyStrong" color="accent">
                + Create “{query.trim()}”
              </Text>
              <Text variant="caption" color="textTertiary" style={{ marginTop: space.xs }}>
                Added to your library as a custom exercise
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Row({ name, meta, onAdd }: { name: string; meta: string; onAdd: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onAdd}
      accessibilityRole="button"
      accessibilityLabel={`Add ${name}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 52,
        borderBottomWidth: 1,
        borderColor: c.hairline,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text variant="body">{name}</Text>
      </View>
      <Text variant="caption" color="textTertiary" style={{ marginRight: space.l }}>
        {meta}
      </Text>
      <IconButton label={`Add ${name}`} onPress={onAdd} style={{ minWidth: 32 }}>
        <Text variant="titleM" color="accent">
          +
        </Text>
      </IconButton>
    </Pressable>
  );
}
