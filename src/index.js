/**
 * HIDE_DEBUG_OUTPUT: Any non-empty value implies no console output by Morgan.
 * PORT: The port on which Rema should run.
 * DB: The MongoDB connection URI.
 * NODE_ENV: The runtime environment, 'development' or 'production'.
 */
require('dotenv').config();

const packageJson = require('./package.json');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { statusCode } = require('statushttp');

const PORT = process.env.PORT ?? 8080;
const DB = process.env.DB ?? `mongodb://localhost/rema`;

// For global await support
(async () => {

// Connect to database
try {
	await mongoose.connect(DB, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
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

// Static files
app.use(express.static(path.join(__dirname, 'static', 'public')));

app.all('*', (req, res) => res.send('Hi'));

app.listen(PORT, () => console.log(`Rema up on port ${PORT}. 😎`));

})();