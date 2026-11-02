import React from 'react';
import { Alert } from 'react-native';
// @ts-expect-error react-test-renderer is supplied by jest-expo without bundled types.
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import RegisterScreen from '../RegisterScreen';
import { register } from '../../api/auth.api';

const submitted = { name: 'Jane Doe', email: 'jane@example.com', password: 'StrongPass1!' };

jest.mock('../../api/auth.api', () => ({ register: jest.fn() }));
// These tests exercise registration outcomes, not input styling or the button renderer.
jest.mock('../../../../components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    AppTextInput: () => null,
    AppButton: ({ onPress }: { onPress: () => void | Promise<void> }) =>
      React.createElement('submit-button', { onPress }),
  };
});
jest.mock('../../components/PasswordValidator', () => () => null);
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

let screen: ReturnType<typeof TestRenderer.create> | undefined;
let testGeneration = 0;

beforeEach(() => {
  testGeneration += 1;
  jest.resetAllMocks();
});

afterEach(async () => {
  // A timed-out render must not continue into another test's submit and alert spy.
  testGeneration += 1;
  try {
    if (screen) {
      const rendered = screen;
      screen = undefined;
      await act(async () => { rendered.unmount(); });
    }
  } finally {
    jest.restoreAllMocks();
    jest.resetAllMocks();
  }
});

async function renderAndSubmit() {
  const generation = testGeneration;
  const navigate = jest.fn();
  await act(async () => {
    screen = TestRenderer.create(React.createElement(RegisterScreen, {
      navigation: { navigate, goBack: jest.fn() },
    } as never));
  });
  if (generation !== testGeneration) throw new Error('Registration test was cleaned up during render');
  const rendered = screen;
  if (!rendered) throw new Error('Registration screen did not render');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(async () => {
    await rendered.root.findByType('submit-button').props.onPress();
  });
  if (generation !== testGeneration) throw new Error('Registration test was cleaned up during submit');
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
});

it('waits for a pending registration response before reporting account creation', async () => {
  const result: Awaited<ReturnType<typeof register>> = {
    user: { id: '507f1f77bcf86cd799439011', name: submitted.name, email: submitted.email,
      createdAt: new Date(), updatedAt: new Date() },
    verificationEmailDelivery: 'queued',
  };
  let resolveResponse!: (value: typeof result) => void;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  const pending = new Promise<typeof result>((resolve) => { resolveResponse = resolve; });
  jest.mocked(register).mockImplementationOnce(() => {
    markStarted();
    return pending;
  });

  const submission = renderAndSubmit();
  try {
    await Promise.race([
      started,
      submission.then(() => { throw new Error('Submission completed before registration started'); }),
    ]);
    expect(register).toHaveBeenCalledWith(submitted);
    expect(Alert.alert).not.toHaveBeenCalled();
    let completed = false;
    void submission.then(() => { completed = true; }, () => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);

    resolveResponse(result);
    const { alert } = await submission;
    expect(alert).toHaveBeenCalledWith(
      'Account created',
      expect.stringContaining('We requested a verification email'),
      expect.any(Array),
    );
  } finally {
    resolveResponse(result);
    await submission.catch(() => {});
  }
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
});
