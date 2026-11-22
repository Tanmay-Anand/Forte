import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, useTextStyle } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Card, Screen, Spacer } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { radius, space } from '@/ui/tokens';
import { BackLink } from '@/features/labs/BackLink';
import { paramsFromLink, parsePairing, type Pairing } from '@/features/sync/link';
import { pairWith, type SendResult } from '@/features/sync/engine';
import { useSettings } from '@/store/settings';

/**
 * Pair with PC — opened by the phone camera from the QR code on Forte
 * Companion's Setup page (forte://pair?...), or from Settings, where the
 * link can be pasted instead.
 *
 * A pairing link decides where the full backup goes, so it is never applied
 * silently: this screen names the PC and asks first. A link from anywhere
 * else (a message, a web page) gets the same question.
 */
export default function PairScreen() {
  const params = useLocalSearchParams<Record<string, string>>();
  const router = useRouter();
  const { c } = useTheme();
  const inputType = useTextStyle('body');
  const current = useSettings((s) => s.pcSync);

  const [pasted, setPasted] = useState('');
  const [fromPaste, setFromPaste] = useState<Pairing | { error: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendResult | undefined>(undefined);
  // Fixed when Pair is tapped: afterwards the saved pairing always matches.
  const [updating, setUpdating] = useState(false);

  const fromLink = useMemo(() => (params.k ? parsePairing(params) : null), [params]);
  // A pasted link wins over a broken one the screen was opened with.
  const candidate = fromPaste ?? fromLink;
  const pairing = candidate && !('error' in candidate) ? candidate : null;
  const error = candidate && 'error' in candidate ? candidate.error : null;
  const samePc = result !== undefined ? updating : Boolean(pairing && current?.id === pairing.id);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const pair = async () => {
    if (!pairing) return;
    setBusy(true);
    setUpdating(samePc);
    setResult(await pairWith(pairing));
    setBusy(false);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <BackLink onPress={leave} />
      <Text variant="displayM">{samePc ? 'Update PC address' : 'Pair with PC'}</Text>

      {result !== undefined ? (
        <>
          <Spacer h={space.l} />
          <Text variant="titleM">{result?.ok ? 'Paired' : 'Paired, not sent yet'}</Text>
          <Text variant="body" color="textSecondary" style={{ marginTop: space.s, maxWidth: 460 }}>
            {result?.ok
              ? `Your first backup is on ${pairing?.name}. From now on Forte sends one after every workout, whenever both are on the same Wi-Fi.`
              : `${result?.error ?? 'The PC did not answer.'} Forte keeps trying when you open the app and after every workout.`}
          </Text>
          {!result?.ok ? (
            <Text variant="caption" color="textTertiary" style={{ marginTop: space.m, maxWidth: 460 }}>
              Check that the phone is on the same Wi-Fi as the PC, not mobile data, and that Windows allowed
              Node.js on private networks when Forte Companion first started.
            </Text>
          ) : null}
          <Spacer h={space.xl} />
          <Button label="Done" onPress={leave} />
        </>
      ) : pairing ? (
        <>
          <Spacer h={space.l} />
          <Card>
            <Text variant="label" color="textTertiary">
              PC
            </Text>
            <Text variant="titleM" style={{ marginTop: space.xs }}>
              {pairing.name}
            </Text>
            <Text variant="num" color="textSecondary" style={{ marginTop: space.xs }}>
              {pairing.hosts.map((h) => `${h}:${pairing.port}`).join('  ·  ')}
            </Text>
          </Card>
          <Text variant="body" color="textSecondary" style={{ marginTop: space.l, maxWidth: 460 }}>
            {samePc
              ? 'Same PC, same key. Only its address is updated.'
              : 'Forte will send your full backup to this PC after every workout: training, body measurements, blood results and saved AI replies. It travels encrypted over your Wi-Fi and never through the internet.'}
          </Text>
          {!samePc ? (
            <Text variant="caption" color="textTertiary" style={{ marginTop: space.m, maxWidth: 460 }}>
              {current
                ? `This replaces ${current.name}, which will stop receiving backups.`
                : 'Only pair with your own computer. You can unpair any time in Settings.'}
            </Text>
          ) : null}
          <Spacer h={space.xl} />
          <Button label={busy ? 'Sending first backup…' : samePc ? 'Update' : 'Pair'} onPress={pair} disabled={busy} />
          <Spacer h={space.s} />
          <Button label="Cancel" variant="ghost" height={48} onPress={leave} disabled={busy} />
        </>
      ) : (
        <>
          <Text variant="body" color="textSecondary" style={{ marginTop: space.m, maxWidth: 460 }}>
            On the PC, open Forte Companion → Setup. Point this phone's camera at the QR code there and
            tap the link. If the camera doesn't offer to open Forte, copy the pairing link under the code
            and paste it here.
          </Text>
          <Spacer h={space.l} />
          <TextInput
            value={pasted}
            onChangeText={(t) => {
              setPasted(t);
              setFromPaste(null);
            }}
            placeholder="forte://pair?…"
            placeholderTextColor={c.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            accessibilityLabel="Pairing link"
            style={{
              ...inputType,
              minHeight: 96,
              color: c.textPrimary,
              borderWidth: 1,
              borderColor: c.lineStrong,
              borderRadius: radius.input,
              padding: space.m,
              textAlignVertical: 'top',
            }}
          />
          {error ? (
            <Text variant="caption" color="negative" style={{ marginTop: space.s }}>
              {error}
            </Text>
          ) : null}
          <Spacer h={space.l} />
          <View>
            <Button
              label="Continue"
              variant="secondary"
              disabled={!pasted.trim()}
              onPress={() => setFromPaste(parsePairing(paramsFromLink(pasted)))}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
