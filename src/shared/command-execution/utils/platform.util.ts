import { stripVTControlCharacters } from 'node:util';

export const stripAnsi = (input: string): string => stripVTControlCharacters(input);
