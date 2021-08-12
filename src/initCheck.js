const fs = require('fs-extra');
const path = require('path');
const { check: portInUse } = require('tcp-port-used');
const axios = require('axios').default;
const unzip = require('unzipper');
const { registerFont } = require('canvas');

const Template = require('./models/template');
const {
	INTERNAL_STATIC_DIR,
	PORT,
	STOCK_DATA_URL
} = require('./constants');

const checks = {
	portFree: {
		msg: `Checking if port ${PORT} is free...`,
		action: async () => {
			const port = Number(PORT);
			
			if (await portInUse(port))
				throw new Error(`Port ${port} already in use!`);

			return `Port available for use!`;
		},
		critical: true
	},
	internalStaticDirectory: {
		msg: `Checking if the internal static directory exists...`,
		action: async () => {
			let fullInternalStaticDir = path.resolve(INTERNAL_STATIC_DIR);
			if (!fullInternalStaticDir.endsWith(path.sep))
				fullInternalStaticDir += path.sep;

			if (!fs.existsSync(fullInternalStaticDir)) {
				try {
					fs.ensureDirSync(fullInternalStaticDir);
				} catch(e) {
					throw new Error(`Failed to ensure internal static directory '${fullInternalStaticDir}' (${e.message})!`);
				}
			}

			return `Internal static directory ensured!`;
		},
		critical: true
	},
	stockMaterial: {
		msg: `Checking if stock material exists...`,
		action: async () => {
			if (!fs.existsSync(INTERNAL_STATIC_DIR))
				throw new Error(`Missing internal static directory '${INTERNAL_STATIC_DIR}'!`);

			const stockDir = path.resolve(INTERNAL_STATIC_DIR, 'stock') + path.sep;
			const templates = await Template.find({ name: /^stock-/ });

			if (!fs.existsSync(stockDir) || (templates.length < 1 && !fs.existsSync(path.join(INTERNAL_STATIC_DIR, 'items.json')))) {
				console.log(`Stock material not found! Downloading...`);

				try {
					fs.ensureDirSync(stockDir);
					fs.emptyDirSync(stockDir);

					const stockZip = path.join(process.env.TMP_DIR, 'stock.zip');

					const done = await new Promise(async resolve => {
						const resp = await axios.get(STOCK_DATA_URL, { responseType: 'stream' });
						const downloadStream = fs.createWriteStream(stockZip);
						resp.data.pipe(downloadStream);

						downloadStream.on('close', () => {
							console.log(`Download finished! Extracting...`);
							const extractStream = fs.createReadStream(stockZip);
							const extractionStream = unzip.Extract({ path: INTERNAL_STATIC_DIR });
							extractStream.pipe(extractionStream);
							extractionStream.on('close', () => resolve('OK'));
						});
					});

					if (done !== 'OK')
						throw new Error();

					console.log(`Extracted! Loading material into database...`);
				} catch(e) {
					throw new Error(`Couldn't ensure stock material in Rema (${e.message})!`);
				}
			}

			try {
				const items = fs.readJSONSync(path.join(INTERNAL_STATIC_DIR, 'items.json'));

				const temps = items.filter(i => i.type === 'template');
				if (templates.length < 1) {
					console.log(`Found ${temps.length} stock templates.`);

					let i = 0;
					for (const t of temps) {
						const {
							name,
							path: templatePath
						} = t;
						if ((await Template.findOne({ name })) == null) {
							try {
								process.stdout.write(`Loading template '${name}' to database...`);
								const fullPath = path.join(INTERNAL_STATIC_DIR, templatePath);
								const obj = fs.readJSONSync(fullPath);
								const te = new Template(obj);
								await te.save()
								process.stdout.write(`\r` + ' '.repeat(60));
								console.log(`\r'${name}' added to database.`);
								i++;
							} catch(e) {
								process.stdout.write(`\r` + ' '.repeat(60));
								console.log(`\rFailed to load tempalte '${name}' into database.`);
							}
						} else
							console.log(`'${name}' already in database. Skipping...`);
					}
				}
			} catch(e) {
				throw new Error(`Failed to load stock templates into database (${e.message})!`);
			}

			return `Stock material loaded!`;
		},
		critical: false
	}
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
			const ret = await action();
			console.log(ret);
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
${successCount > 0 ? '✔' : '-'} ${successCount} check(s) passed!
${failureCount > 0 ? '❌' : '✔'} ${failureCount} check(s) failed!\
${
	criticalFailureCount > 0
	? `\n❌ ${criticalFailureCount} critical check(s) failed!`
	: ''
}`
	};
};