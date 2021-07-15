const fs = require('fs-extra');
const path = require('path');
const { check: portInUse } = require('tcp-port-used');
const {
	INTERNAL_STATIC_DIR,
	PORT
} = require('./constants');

const checks = {
	portFree: {
		msg: `Checking if port ${PORT} is free...`,
		action: async () => {
			const port = PORT;
			
			// Creating a new server just to check for a free port has some caveats
			/* const inUse = p => new Promise(resolve => {
				const server = net.createServer();

				server.once('error', err => {
					if (err.code === 'EADDRINUSE')
						resolve(true);
				});

				server.once('listening', () => {
					server.close();
					resolve(false);
				});

				server.listen(p);
			}); */

			if (await portInUse(port))
				throw new Error(`Port ${port} already in use!`);
		},
		critical: true
	},
	internalStaticDirectory: {
		msg: `Checking if the internal static directory exists...`,
		action: async () => {
			let fullInternalStaticDir = path.resolve(INTERNAL_STATIC_DIR);
			if (!fullInternalStaticDir.endsWith(path.sep))
				fullInternalStaticDir += path.sep;

			if (!fs.existsSync(fullInternalStaticDir))
				throw new Error(`Internal static directory '${fullInternalStaticDir}' doesn't exist!`);
		},
		critical: true
	},
};

module.exports = async () => {
	console.log(`Performing initial checks...`);

	let i = 1;
	let successCount = 0;
	let failureCount = 0;
	let criticalFailureCount = 0;

	for (const checkID in checks) {
		const {
			msg,
			action,
			critical
		} = checks[checkID];

		console.log(`${i}. ${msg}`);
		try {
			await action();
			successCount++;
		} catch(e) {
			console.log(e.message);
			failureCount++;
			if (critical)
				criticalFailureCount++;
		}

		i++;
	}

	return {
		success: criticalFailureCount === 0,
		msg: `\
${successCount > 0 ? '✔' : ''} ${successCount} check(s) passed!
${failureCount > 0 ? '❌' : '✔'} ${failureCount} check(s) failed!`
	};
};