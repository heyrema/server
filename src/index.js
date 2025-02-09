/**
 * HIDE_DEBUG_OUTPUT: Any non-empty value implies no console output by Morgan.
 * PORT: The port on which Rema should run.
 * DB: The MongoDB connection URI.
 * NODE_ENV: The runtime environment, 'development' or 'production'.
 * MAX_DIMENSION_OVERRIDE: Override the maximum dimension supported by Rema; Can go as high as 32767 (the maximum supported by Cairo)
 * INTERNAL_STATIC_DIR: The folder where all internal static resources are stored by Rema, such as images.
 * BASE_ROUTE: The route on which Rema is mounted, '/' by default.
 * DIRECTORY: Any non-empty value implies the certificate directory is to be made available.
 */
require('dotenv').config();

const packageJson = require('./package.json');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const expressMinify = require('express-minify');
const expressMinifyHTML = require('express-minify-html-2');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { statusCode } = require('statushttp');
const tmp = require('tmp');
const PrettyError = require('pretty-error');
const ON_DEATH = require('death')({
	uncaughtException: true
});

if ('FONTS_LOADED' in process.env)
	delete process.env.FONTS_LOADED;

const tempDirectory = tmp.dirSync();
process.env.TMP_DIR = tempDirectory.name;

const exitHandler = function(sig, err) {
	let exitCode = 0;
	if (typeof err === 'object') {
		console.log(new PrettyError().render(err));
		exitCode = 1;
	}
	console.log(`\rCleaning up... 🎀`);
	if (fs.existsSync(tempDirectory.name))
		fs.emptyDirSync(tempDirectory.name);
	tempDirectory.removeCallback();
	console.log(`Exitting Rema... 🌸`);
	process.exit(exitCode);
};

ON_DEATH(exitHandler);
process.on('SIGUSR1', exitHandler.bind(null));
process.on('SIGUSR2', exitHandler.bind(null));

const {
	PORT,
	DB
} = require('./constants');

const templateRouter = require('./routes/template');
const certificateRouter = require('./routes/certificate');
const publicRouter = require('./routes/public');

// For global await support
(async () => {

// Connect to database
try {
	await mongoose.connect(DB);
	console.log(`Connected to the database. 🔐`);
} catch(e) {
	console.error(`Failed to connect to database: "${e.message}"`);
	process.exit(1);
}

// Perform some initial checks
const initResults = await require('./initCheck')();
console.log(initResults.msg);
if (!initResults.success)
	process.exit(1);

const app = express();

// Show debug output to console
if (process.env.NODE_ENV !== 'production' || !process.env.HIDE_DEBUG_OUTPUT)
	app.use(morgan('dev'));

if (!process.env.NO_MINIFY) {
	app.use(expressMinify());
	app.use(expressMinifyHTML({
		override: true,
		exception_url: false,
		htmlMinifier: {
			removeOptionalTags: false,
			removeComments: true,
			collapseWhitespace: true,
			collapseInlineWhitespace: true,
			removeAttributeQuotes: false,
			removeEmptyAttributes: false,
			conservativeCollapse: true,
			minifyJS: true
		}
	}));
}

app.set('view engine', 'ejs');

// Powered by Rema :P
app.use((req, res, next) => {
	let poweredBy = res.getHeader('X-Powered-By');
	if (poweredBy == null)
		poweredBy = `Rema v${packageJson.version}`;
	else
		poweredBy = `Rema v${packageJson.version}, ${poweredBy}`;
	
	res.setHeader('X-Powered-By', poweredBy);
	next();
});

// Parsing request bodies
app.use(express.json({ limit: '10mb', strict: false }));
app.use(express.urlencoded({ extended: true }));

// Static files (currently just the favicon)
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/template', templateRouter);
app.use('/api/certificate', certificateRouter);
app.use('/', publicRouter);

app.all('', (req, res) => res.status(statusCode.NOT_IMPLEMENTED).send('Hello, World! :) Check back later for more.'));

app.listen(PORT, () => console.log(`\
Rema up on port ${PORT}. 😎
Press Ctrl+C to exit. ✨`));

})();