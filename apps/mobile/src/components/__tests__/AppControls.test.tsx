import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import AppButton from '../AppButton';
import AppTextInput from '../AppTextInput';

jest.mock('@expo/vector-icons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Ionicons: (props: React.ComponentProps<typeof Text>) => React.createElement(Text, { ...props, accessible: false }) };
});

describe('AppTextInput accessibility and password visibility', () => {
  it('starts concealed and toggles visibility without losing the value or change handler', () => {
    const onChangeText = jest.fn();
    const { rerender } = render(<AppTextInput accessibilityLabel="Password" secureTextEntry value="Secret123!" onChangeText={onChangeText} />);

    const input = screen.getByLabelText('Password');
    expect(input.props.secureTextEntry).toBe(true);
    fireEvent.changeText(input, 'Changed123!');
    expect(onChangeText).toHaveBeenCalledWith('Changed123!');
    rerender(<AppTextInput accessibilityLabel="Password" secureTextEntry value="Changed123!" onChangeText={onChangeText} />);

    fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText('Password').props.value).toBe('Changed123!');
    fireEvent.press(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  });

  it('keeps ordinary inputs ordinary and conceals when password mode is re-entered', () => {
    const { rerender } = render(<AppTextInput accessibilityLabel="Email address" value="a@example.com" secureTextEntry={false} />);
    expect(screen.getByLabelText('Email address').props.secureTextEntry).toBe(false);
    expect(screen.queryByRole('button', { name: 'Show password' })).toBeNull();

    rerender(<AppTextInput accessibilityLabel="Email address" value="a@example.com" />);
    expect(screen.queryByRole('button', { name: 'Show password' })).toBeNull();

    rerender(<AppTextInput accessibilityLabel="Password" value="Secret123!" secureTextEntry />);
    fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);

    rerender(<AppTextInput accessibilityLabel="Email address" value="Secret123!" secureTextEntry={false} />);
    expect(screen.queryByRole('button', { name: 'Hide password' })).toBeNull();
    rerender(<AppTextInput accessibilityLabel="Password" value="Secret123!" secureTextEntry />);
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    expect(screen.getByRole('button', { name: 'Show password' })).toBeTruthy();
  });

  it('exposes the field name and validation error without grouping its controls', () => {
    render(<AppTextInput accessibilityLabel="Email address" error="Enter a valid email address" />);
    expect(screen.getByLabelText('Email address').props.accessibilityHint).toContain('Enter a valid email address');
    expect(screen.getByRole('alert').props.children).toBe('Enter a valid email address');
  });
});

describe('AppButton accessibility and activation', () => {
  it('has a named button role and invokes its enabled action', () => {
    const onPress = jest.fn();
    render(<AppButton title="Continue" onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Continue' });
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(button.props.accessibilityState).toEqual({ disabled: false, busy: false });
  });

  it('does not activate while disabled and preserves its name and busy state while loading', () => {
    const onPress = jest.fn();
    const { rerender } = render(<AppButton title="Try again" onPress={onPress} disabled />);
    const disabledButton = screen.getByRole('button', { name: 'Try again' });
    fireEvent.press(disabledButton);
    expect(onPress).not.toHaveBeenCalled();
    expect(disabledButton.props.accessibilityState).toEqual({ disabled: true, busy: false });

    rerender(<AppButton title="Try again" onPress={onPress} loading />);
    const loadingButton = screen.getByRole('button', { name: 'Try again' });
    fireEvent.press(loadingButton);
    expect(onPress).not.toHaveBeenCalled();
    expect(loadingButton.props.accessibilityState).toEqual({ disabled: true, busy: true });

    rerender(<AppButton title="Try again" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
