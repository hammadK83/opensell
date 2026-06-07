/// <reference types="nativewind/types" />
// Inform the compiler that side-effect stylesheet path imports are valid modules
declare module '*.css';
// FIX FOR TS2306: Explicitly map the structural export types
// that NativeWind's compiler fails to expose automatically.
declare module 'nativewind/preset' {
  const preset: Record<string, unknown>;
  export default preset;
}
