import { Redirect } from 'expo-router';

export default function UserIndex() {
  return <Redirect href="/(user)/(tabs)/home" />;
}

