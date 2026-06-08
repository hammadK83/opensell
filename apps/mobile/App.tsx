import { Provider } from 'react-redux';
import { store } from './src/store';
import { AuthNavigator } from './src/features/auth/navigation/AuthNavigator';

export default function App() {
  return (
    <Provider store={store}>
      <AuthNavigator />
    </Provider>
  );
}
