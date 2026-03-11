import { SKILL_CONTENT_GUIDE_LINES } from './skill-content-guide.const';
import { SKILL_CONTENT_INTRO_LINES } from './skill-content-intro.const';

const skillContentLines = [...SKILL_CONTENT_INTRO_LINES, ...SKILL_CONTENT_GUIDE_LINES];

export const SKILL_CONTENT = skillContentLines.join('\n');
