// __APP_VERSION__ is injected by esbuild `define` at build time; falls back in dev/test.
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev';
