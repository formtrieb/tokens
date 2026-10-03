import { generateTokenMap } from '../generators/token-map.js';
import config from '../../formtrieb-tokens.config.js';

generateTokenMap(config).catch((err) => {
	console.error(err);
	process.exit(1);
});
