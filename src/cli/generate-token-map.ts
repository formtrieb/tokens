import { generateTokenMap } from '../generators/token-map.js';

generateTokenMap().catch((err) => {
	console.error(err);
	process.exit(1);
});
