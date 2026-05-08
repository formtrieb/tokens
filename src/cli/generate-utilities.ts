import { generateAllUtilities } from '../generators/utilities.js';

generateAllUtilities().catch((err) => {
	console.error(err);
	process.exit(1);
});
