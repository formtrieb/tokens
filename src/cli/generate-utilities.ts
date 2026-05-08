import { generateAllUtilities } from '../generators/utilities.js';
import config from '../../formtrieb-tokens.config.js';

generateAllUtilities(config).catch((err) => {
	console.error(err);
	process.exit(1);
});
