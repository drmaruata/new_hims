// This package is browser-rendered React library, no Next.js.
//
// The rule set itself lives in the workspace root so every package shares one
// set; see `eslint.config.base.mjs` for why.
import { himsConfig, RUNTIMES } from '../../eslint.config.base.mjs';

export default himsConfig({ runtime: RUNTIMES.browser, react: true });
