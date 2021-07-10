/**
 * HIDE_DEBUG_OUTPUT: Any non-empty value implies no console output by Morgan
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

const app = express();

// Show debug output to console
if (process.env.NODE_ENV !== 'production' || !process.env.HIDE_DEBUG_OUTPUT)
	app.use(morgan('dev'));

//
app.use((req, res, next) => {
	let poweredBy = res.getHeader('X-Powered-By');
	if (poweredBy == null)
		poweredBy = `Rema v${packageJson.version}`;
	else
		poweredBy = `Rema v${packageJson.version}, ${poweredBy}`;
	
	res.setHeader('X-Powered-By', poweredBy);
	next();
});

app.all('*', (req, res) => res.send('Hi'));

app.listen(PORT, () => console.log(`Rema up on port ${PORT}. 😎`));