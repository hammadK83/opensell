import React from 'react';
import { Text } from 'react-native';
// @ts-expect-error react-test-renderer is supplied by jest-expo without bundled types.
import TestRenderer, { act } from 'react-test-renderer';
import { expect, it } from '@jest/globals';
import PasswordValidator from '../PasswordValidator';

async function byteLimitRequirement(password: string) {
  let component: ReturnType<typeof TestRenderer.create>;
  await act(async () => {
    component = TestRenderer.create(React.createElement(PasswordValidator, { password }));
  });
  return component!.root.findAllByType(Text).find(
    (node: { props: { children: unknown[] } }) => node.props.children.includes('At most 72 UTF-8 bytes'),
  );
}

it('shows the byte limit as met at 72 UTF-8 bytes', async () => {
  const requirement = await byteLimitRequirement(`Aa1!${'é'.repeat(34)}`);
  expect(requirement?.props.className).toContain('text-success');
});

it('shows the byte limit as unmet at 73 UTF-8 bytes', async () => {
  const requirement = await byteLimitRequirement(`Aa1!${'é'.repeat(34)}a`);
  expect(requirement?.props.className).toContain('text-textSecondary');
});
