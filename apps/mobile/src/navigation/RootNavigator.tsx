import AppStack from './AppStack';
import AuthStack from '../features/auth/navigation/AuthStack';

import { useAppSelector } from '../store/hooks';

export default function RootNavigator() {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  return isAuthenticated ? <AppStack /> : <AuthStack />;
}
