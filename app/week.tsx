import { Redirect } from 'expo-router';

/** Week is now Plan. The old route stays so links and muscle memory keep working. */
export default function WeekRedirect() {
  return <Redirect href="/plan" />;
}
