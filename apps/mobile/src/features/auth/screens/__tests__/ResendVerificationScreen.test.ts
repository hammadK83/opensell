import React from 'react';
import { Alert, TouchableOpacity, TextInput } from 'react-native';
// @ts-expect-error react-test-renderer is supplied by jest-expo without bundled types.
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import ResendVerificationScreen from '../ResendVerificationScreen';
import { resendVerification } from '../../api/auth.api';

jest.mock('../../api/auth.api', () => ({ resendVerification: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); });

describe('resend verification screen', () => {
  it('prefills registration email and shows the neutral server confirmation', async () => {
    const confirmation = 'If this email belongs to an unverified account, a link may arrive.';
    jest.mocked(resendVerification).mockResolvedValueOnce(confirmation);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    let screen: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      screen = TestRenderer.create(React.createElement(ResendVerificationScreen, {
        route: { params: { email: 'jane@example.com' } },
      } as never));
    });
    expect(screen!.root.findByType(TextInput).props.value).toBe('jane@example.com');
    await act(async () => {
      screen!.root.findByType(TouchableOpacity).props.onPress();
    });
    expect(resendVerification).toHaveBeenCalledWith('jane@example.com');
    expect(alert).toHaveBeenCalledWith('Request received', confirmation);
    alert.mockRestore();
  });

  it('explains an invalid address without contacting the backend', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    let screen: ReturnType<typeof TestRenderer.create>;
    await act(async () => {
      screen = TestRenderer.create(React.createElement(ResendVerificationScreen, {
        route: { params: { email: 'invalid' } },
      } as never));
    });
    await act(async () => {
      screen!.root.findByType(TouchableOpacity).props.onPress();
    });
    expect(alert).toHaveBeenCalledWith('Invalid email', 'Enter a valid email address.');
    expect(resendVerification).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
