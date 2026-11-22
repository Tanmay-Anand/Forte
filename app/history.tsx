import { Redirect } from 'expo-router';

/** History is now Log · Sessions. The old route stays so links and muscle memory keep working. */
export default function HistoryRedirect() {
  return <Redirect href="/log" />;
}
