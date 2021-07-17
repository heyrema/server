const path = require('path');
const fs = require('fs-extra');

const { INTERNAL_STATIC_DIR } = require('../constants');

const resolveItemPath = src => {
	for (const DIR of [INTERNAL_STATIC_DIR]) {
		if (DIR == null)
			continue;
		const location = path.join(DIR, src);
		if (fs.existsSync(location));
			return location;
	}

	return false;
};

module.exports = {
	resolveItemPath
};