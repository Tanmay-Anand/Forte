import { Redirect } from 'expo-router';

/** Progress is now Log · Lifts. The old route stays so links and muscle memory keep working. */
export default function ProgressRedirect() {
  return <Redirect href="/log?view=lifts" />;
}
