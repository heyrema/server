const path = require('path');
const fs = require('fs-extra');

const {
	INTERNAL_STATIC_DIR
} = require('../constants');

// Test if image is valid
const validateImage = async src => {
	if (!/^(https?:\/\/|data:)/.test(src)) {
		try {
			const location = path.join(INTERNAL_STATIC_DIR, src);
			await fs.stat(location);
		} catch(e) {
			return false;
		}
	}
	return true;
};

// Retrieve absolute path if local
const getImageLocation = async src => {
	if (validateImage(src))
		return /^(https?:\/\/|data:)/.test(src) ? src : path.join(INTERNAL_STATIC_DIR, src);
	return false;
};

module.exports = {
	validateImage,
	getImageLocation
};