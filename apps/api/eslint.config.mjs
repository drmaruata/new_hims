// This package is server-side Node, no JSX.
//
// The rule set itself lives in the workspace root so every package shares one
// set; see `eslint.config.base.mjs` for why.
import { himsConfig, RUNTIMES } from '../../eslint.config.base.mjs';

export default himsConfig({ runtime: RUNTIMES.node });
