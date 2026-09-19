import { AppButton } from '../../../components';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { signOut } from '../auth.logout';

export default function LogoutButton() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.auth.status);
  return <AppButton title="Sign out" loading={status === 'signingOut'}
    disabled={status !== 'authenticated'} onPress={() => { void dispatch(signOut()); }} />;
}
