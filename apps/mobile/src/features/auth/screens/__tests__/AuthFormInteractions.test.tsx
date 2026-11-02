import React from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { jest } from '@jest/globals';
import AppButton from '../../../../components/AppButton';
import LoginScreen from '../LoginScreen';
import RegisterScreen from '../RegisterScreen';
import ResendVerificationScreen from '../ResendVerificationScreen';
import { login, register, resendVerification } from '../../api/auth.api';
import { useAppDispatch } from '../../../../store/hooks';
import { getSessionGeneration, saveSessionTokens } from '../../../../services/storage/session-lifecycle';

jest.mock('@react-navigation/elements', () => ({
  ...jest.requireActual<typeof import('@react-navigation/elements')>('@react-navigation/elements'),
  useHeaderHeight: () => 56,
}));
jest.mock('../../api/auth.api', () => ({
  login: jest.fn(),
  register: jest.fn(),
  resendVerification: jest.fn(),
}));
jest.mock('../../../../store/hooks', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn((selector: (state: unknown) => unknown) => selector({
    auth: { status: 'signedOut', logoutNotice: null },
  })),
}));
jest.mock('../../../../services/storage/session-lifecycle', () => ({
  getSessionGeneration: jest.fn(),
  saveSessionTokens: jest.fn(),
}));

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

function renderAuth(element: React.ReactElement) {
  return render(element, {
    wrapper: ({ children }) => <SafeAreaProvider initialMetrics={safeAreaMetrics}>{children}</SafeAreaProvider>,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const user = {
  id: '507f1f77bcf86cd799439011',
  name: 'Jane Doe',
  email: 'jane@example.com',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const loginResponse = { user, accessToken: 'access-token', refreshToken: 'refresh-token' };
const registerResponse = { user, verificationEmailDelivery: 'queued' as const };

const mockLogin = jest.mocked(login);
const mockRegister = jest.mocked(register);
const mockResend = jest.mocked(resendVerification);
const mockDispatch = jest.mocked(useAppDispatch);
const mockGeneration = jest.mocked(getSessionGeneration);
const mockSaveTokens = jest.mocked(saveSessionTokens);

beforeEach(() => {
  jest.clearAllMocks();
  mockDispatch.mockReturnValue(jest.fn() as never);
  mockGeneration.mockReturnValue(7);
  mockSaveTokens.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('LoginScreen form interactions', () => {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };

  beforeEach(() => navigation.navigate.mockClear());

  it('validates edited values, enables valid submission, and exposes field errors', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    renderAuth(<LoginScreen navigation={navigation as never} route={{} as never} />);

    const email = screen.getByLabelText('Email address');
    const password = screen.getByLabelText('Password');
    fireEvent.changeText(email, 'not-an-email');
    fireEvent.changeText(password, '');
    await waitFor(() => expect(screen.getByLabelText('Email address').props.accessibilityHint).toContain('Email is required'));
    const submit = screen.getByRole('button', { name: 'Sign In' });
    expect(submit.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(submit);
    expect(mockLogin).not.toHaveBeenCalled();

    fireEvent.changeText(email, 'jane@example.com');
    fireEvent.changeText(password, 'password123');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign In' }).props.accessibilityState.disabled).toBe(false));
    expect(alert).not.toHaveBeenCalled();
  });

  it('stays pending until token storage finishes and prevents duplicate login activation', async () => {
    const request = deferred<typeof loginResponse>();
    const storageWrite = deferred<void>();
    mockLogin.mockReturnValueOnce(request.promise);
    mockSaveTokens.mockReturnValueOnce(storageWrite.promise);
    const dispatch = jest.fn();
    mockDispatch.mockReturnValue(dispatch as never);
    const rendered = renderAuth(<LoginScreen navigation={navigation as never} route={{} as never} />);
    fireEvent.changeText(screen.getByLabelText('Email address'), 'jane@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    const submit = rendered.UNSAFE_getByType(AppButton);

    act(() => {
      void submit.props.onPress();
      void submit.props.onPress();
    });
    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(1));
    expect(mockLogin).toHaveBeenCalledWith({ email: 'jane@example.com', password: 'password123' });
    const pendingButton = screen.getByRole('button', { name: 'Sign In' });
    expect(pendingButton.props.accessibilityState).toEqual({ disabled: true, busy: true });
    fireEvent.press(pendingButton);
    expect(mockLogin).toHaveBeenCalledTimes(1);

    await act(async () => { request.resolve(loginResponse); });
    expect(mockSaveTokens).toHaveBeenCalledWith('access-token', 'refresh-token', 7);
    expect(dispatch).not.toHaveBeenCalled();
    const storagePendingButton = screen.getByRole('button', { name: 'Sign In' });
    expect(storagePendingButton.props.accessibilityState).toEqual({ disabled: true, busy: true });
    fireEvent.press(storagePendingButton);
    act(() => { void rendered.UNSAFE_getByType(AppButton).props.onPress(); });
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();

    await act(async () => { storageWrite.resolve(undefined); });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('does not authenticate after API or token-storage failure and allows a retry', async () => {
    const dispatch = jest.fn();
    mockDispatch.mockReturnValue(dispatch as never);
    mockLogin.mockRejectedValueOnce(new Error('network failure')).mockResolvedValue(loginResponse);
    mockSaveTokens.mockRejectedValueOnce(new Error('secure storage unavailable')).mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    renderAuth(<LoginScreen navigation={navigation as never} route={{} as never} />);
    fireEvent.changeText(screen.getByLabelText('Email address'), 'jane@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password123');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign In' }).props.accessibilityState.disabled).toBe(false));
    const submit = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.press(submit);
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Error', expect.any(String)));
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => expect(mockSaveTokens).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(alert).toHaveBeenCalledTimes(2));
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    expect(mockLogin).toHaveBeenCalledTimes(3);
  });

  it('navigates to registration and verification recovery actions', () => {
    renderAuth(<LoginScreen navigation={navigation as never} route={{} as never} />);
    fireEvent.press(screen.getByRole('button', { name: 'Create an account' }));
    fireEvent.press(screen.getByRole('button', { name: 'Resend verification email' }));
    expect(navigation.navigate).toHaveBeenNthCalledWith(1, 'Register');
    expect(navigation.navigate).toHaveBeenNthCalledWith(2, 'ResendVerification');
  });
});

describe('RegisterScreen form interactions', () => {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };

  it('uses resolver validation and updates the password checklist as fields are edited', async () => {
    renderAuth(<RegisterScreen navigation={navigation as never} route={{} as never} />);
    const submit = screen.getByRole('button', { name: 'Create Account' });
    fireEvent.changeText(screen.getByLabelText('Name'), 'J');
    fireEvent.changeText(screen.getByLabelText('Email address'), 'invalid');
    fireEvent.changeText(screen.getByLabelText('Password'), 'short');
    expect(screen.getByLabelText('At least 8 characters, not met')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Invalid email address/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Create Account' }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(submit);
    expect(mockRegister).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText('Name'), 'Jane Doe');
    fireEvent.changeText(screen.getByLabelText('Email address'), 'jane@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'StrongPass1!');
    expect(screen.getByLabelText('At least 8 characters, met')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Account' }).props.accessibilityState.disabled).toBe(false));
  });

  it('prevents rapid duplicate registrations, reports pending state, and releases the guard after failure', async () => {
    const request = deferred<typeof registerResponse>();
    mockRegister.mockReturnValueOnce(request.promise).mockResolvedValueOnce(registerResponse);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const rendered = renderAuth(<RegisterScreen navigation={navigation as never} route={{} as never} />);
    fireEvent.changeText(screen.getByLabelText('Name'), 'Jane Doe');
    fireEvent.changeText(screen.getByLabelText('Email address'), 'jane@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'StrongPass1!');
    const submit = rendered.UNSAFE_getByType(AppButton);

    act(() => {
      void submit.props.onPress();
      void submit.props.onPress();
    });
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Create Account' }).props.accessibilityState)
      .toEqual({ disabled: true, busy: true });
    await act(async () => { request.reject(new Error('registration failed')); });
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Registration Error', expect.any(String)));

    fireEvent.press(screen.getByRole('button', { name: 'Create Account' }));
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Account created', expect.any(String), expect.any(Array)));
  });
});

describe('ResendVerificationScreen form interactions', () => {
  it('prefills, validates, prevents rapid duplicate requests, and releases after completion', async () => {
    const request = deferred<string>();
    mockResend.mockReturnValueOnce(request.promise).mockResolvedValueOnce('A link may arrive.');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const rendered = renderAuth(<ResendVerificationScreen navigation={{} as never} route={{ params: { email: 'jane@example.com' } } as never} />);
    expect(screen.getByLabelText('Email address').props.value).toBe('jane@example.com');

    fireEvent.changeText(screen.getByLabelText('Email address'), 'not-an-email');
    fireEvent.press(screen.getByRole('button', { name: 'Request verification email' }));
    expect(mockResend).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Invalid email', 'Enter a valid email address.');

    fireEvent.changeText(screen.getByLabelText('Email address'), 'jane@example.com');
    const submit = rendered.UNSAFE_getByType(AppButton);
    act(() => {
      void submit.props.onPress();
      void submit.props.onPress();
    });
    await waitFor(() => expect(mockResend).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Request verification email' }).props.accessibilityState)
      .toEqual({ disabled: true, busy: true });
    await act(async () => { request.reject(new Error('temporary failure')); });
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not request email', expect.any(String)));

    fireEvent.press(screen.getByRole('button', { name: 'Request verification email' }));
    await waitFor(() => expect(mockResend).toHaveBeenCalledTimes(2));
    expect(alert).toHaveBeenCalledWith('Request received', 'A link may arrive.');
  });
});
