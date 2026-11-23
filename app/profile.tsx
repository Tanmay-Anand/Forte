import { Redirect } from 'expo-router';

/** Profile is now You. The old route stays so links and muscle memory keep working. */
export default function ProfileRedirect() {
  return <Redirect href="/you" />;
}
