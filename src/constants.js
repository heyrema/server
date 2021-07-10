const path = require('path');

const STATIC_DIR = path.resolve(__dirname, 'static');
const INTERNAL_STATIC_DIR = path.resolve(STATIC_DIR, 'internal');

module.exports = {
	STATIC_DIR,
	INTERNAL_STATIC_DIR
};