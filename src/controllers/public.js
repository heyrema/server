const { statusCode } = require('statushttp');

const {
	BASE_ROUTE
} = require('../constants');
const Template = require('../models/template');
const Certificate = require('../models/certificate');

// Only for documentation purposes
const { RequestHandler, Request, Response } = require('express');

/**
 * The homepage
 * @type {RequestHandler}
 */
const index = (req, res) => {
	return res.status(statusCode.OK).render('index', {
		base: BASE_ROUTE,
		directory: !!process.env.DIRECTORY
	});
};

/**
 * The directory
 * @type {RequestHandler}
 */
const directory = async (req, res) => {
	if (!process.env.DIRECTORY)
		return res.status(statusCode.NOT_FOUND).render('404', {
			base: BASE_ROUTE,
			title: `Not Found`
		});

	const certs = await Certificate.find({}, { uid: 1, _id: 0 }).sort({ date: -1 });

	return res.status(statusCode.OK).render('directory', {
		base: BASE_ROUTE,
		title: `Directory`,
		certificates: certs.map(c => c.uid)
	});
};

/**
 * Serves a certificate
 * @type {RequestHandler}
 */
 const certificate = async (req, res) => {
	const { uid } = req.params; 

	const cert = await Certificate.findOne({ uid });
	if (cert == null)
		return res.status(statusCode.NOT_FOUND).render('404', {
			base: BASE_ROUTE,
			title: `Invalid ID`
		});
	
	const template = await Template.findOne({ name: cert.template });
	if (template == null) {
		await cert.delete();
		return res.status(statusCode.NOT_FOUND).render('404', {
			base: BASE_ROUTE,
			title: `Invalid ID`
		});
	}

	return res.status(statusCode.OK).render('certificate', {
		info: {
			...cert._doc,
			dimensions: template.dimensions
		}, uid,
		download: `certificate/${uid}/certificate`,
		base: BASE_ROUTE,
		filename: 'certificate'
	});
};

module.exports = {
	index,
	directory,
	certificate
};