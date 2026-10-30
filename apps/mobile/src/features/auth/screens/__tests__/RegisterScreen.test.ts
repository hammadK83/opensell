import React from 'react';
import { Alert, TouchableOpacity } from 'react-native';
// @ts-expect-error react-test-renderer is supplied by jest-expo without bundled types.
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, expect, it, jest } from '@jest/globals';
import RegisterScreen from '../RegisterScreen';
import { register } from '../../api/auth.api';

const submitted = { name: 'Jane Doe', email: 'jane@example.com', password: 'StrongPass1!' };

jest.mock('../../api/auth.api', () => ({ register: jest.fn() }));
jest.mock('react-hook-form', () => ({
  useForm: () => ({
    control: {},
    handleSubmit: (submit: (data: typeof submitted) => Promise<void>) => () => submit(submitted),
    watch: () => '',
    formState: { errors: {}, isSubmitting: false, isValid: true },
  }),
  Controller: ({ render }: { render: (props: unknown) => React.ReactNode }) =>
    render({ field: { onChange: () => {}, onBlur: () => {}, value: '' } }),
}));

beforeEach(() => { jest.clearAllMocks(); });

async function renderAndSubmit() {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const navigate = jest.fn();
  let screen: ReturnType<typeof TestRenderer.create>;
  await act(async () => {
    screen = TestRenderer.create(React.createElement(RegisterScreen, {
      navigation: { navigate, goBack: jest.fn() },
    } as never));
  });
  await act(async () => {
    screen!.root.findByType(TouchableOpacity).props.onPress();
  });
  return { alert, navigate };
}

it('explains that email delivery was requested after account creation', async () => {
  jest.mocked(register).mockResolvedValueOnce({
    user: { id: '507f1f77bcf86cd799439011', name: submitted.name, email: submitted.email,
      createdAt: new Date(), updatedAt: new Date() },
    verificationEmailDelivery: 'queued',
  });
  const { alert } = await renderAndSubmit();
  expect(alert).toHaveBeenCalledWith(
    'Account created',
    expect.stringContaining('We requested a verification email'),
    expect.any(Array),
  );
  alert.mockRestore();
});

it('offers recovery when the registration response is lost after account creation', async () => {
  jest.mocked(register).mockRejectedValueOnce(Object.assign(new Error('timeout'), { isAxiosError: true }));
  const { alert, navigate } = await renderAndSubmit();
  expect(alert).toHaveBeenCalledWith(
    'Could not confirm registration',
    expect.stringContaining('Your account may have been created'),
    expect.any(Array),
  );
  const actions = alert.mock.calls[0][2];
  actions?.[0]?.onPress?.();
  expect(navigate).toHaveBeenCalledWith('ResendVerification', { email: submitted.email });
  alert.mockRestore();
});

it('offers verification recovery after a duplicate registration response', async () => {
  jest.mocked(register).mockRejectedValueOnce(Object.assign(new Error('conflict'), {
    isAxiosError: true,
    response: { status: 409 },
  }));
  const { alert, navigate } = await renderAndSubmit();
  expect(alert).toHaveBeenCalledWith(
    'Could not confirm registration',
    expect.stringContaining('request a verification link'),
    expect.any(Array),
  );
  alert.mock.calls[0][2]?.[0]?.onPress?.();
  expect(navigate).toHaveBeenCalledWith('ResendVerification', { email: submitted.email });
  alert.mockRestore();
});
