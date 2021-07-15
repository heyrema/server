/**
 * HIDE_DEBUG_OUTPUT: Any non-empty value implies no console output by Morgan.
 * PORT: The port on which Rema should run.
 * DB: The MongoDB connection URI.
 * NODE_ENV: The runtime environment, 'development' or 'production'.
 * MAX_DIMENSION_OVERRIDE: Override the maximum dimension supported by Rema; Can go as high as 32767 (the maximum supported by Cairo)
 * INTERNAL_STATIC_DIR: The folder where all internal static resources are stored by Rema, such as images.
 * BASE_ROUTE: The route on which Rema is mounted, '/' by default.
 */
require('dotenv').config();

process.on('SIGINT', function() {
	console.log(`\rExitting Rema... 🌸`);
	process.exit();
});

const packageJson = require('./package.json');
const path = require('path');
const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { statusCode } = require('statushttp');

const {
	PORT,
	DB
} = require('./constants');

const templateRouter = require('./routes/template');

// For global await support
(async () => {

// Perform some initial checks
const initResults = await require('./initCheck')();
console.log(initResults.msg);
if (!initResults.success)
	process.exit(1);

// Connect to database
try {
	await mongoose.connect(DB, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useCreateIndex: true
	});
	console.log(`Connected to database. 🔐`);
} catch(e) {
	console.log(`Failed to connect to database: "${e.message}"`);
	process.exit(1);
}

const app = express();

// Show debug output to console
if (process.env.NODE_ENV !== 'production' || !process.env.HIDE_DEBUG_OUTPUT)
	app.use(morgan('dev'));

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

app.all('*', (req, res) => res.status(statusCode.NOT_IMPLEMENTED).send('Hello, World! :) Check back later for more.'));

app.listen(PORT, () => console.log(`\
Rema up on port ${PORT}. 😎
Press Ctrl+C to exit. ✨`));

})();