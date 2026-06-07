/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-undef */

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: './global.css',
  projectRoot: __dirname,
  configPath: path.resolve(__dirname, 'tailwind.config.js'),
});
