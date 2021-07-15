const { statusCode } = require('statushttp');
const { nanoid } = require('nanoid');
const sanitizeFileName = require('sanitize-filename');

// Only for documentation purposes
const { RequestHandler, Request, Response } = require('express');

const Template = require('../models/template');
const Certificate = require('../models/certificate');
const {
	validateImage,
	getImageLocation,
	imgToBase64
} = require('../helpers/image');
const {
	render
} = require('../helpers/render');

/**
 * Validate and do something
 * @param {Request} req
 * @param {Response} res
 * @param {Object} body
 */
const validateAndDoSomething = async (req, res, body) => {
	const { values } = body;

	if (values.filter(v => v?.value == null).length > 0)
		return res.status(statusCode.BAD_REQUEST).send(`Empty values not allowed!`);

	const template = await Template.findOne({ name: body.template });
	if (template == null)
		return res.status(statusCode.NOT_FOUND).send(`Template not found!`);
	
	const validValues = [];

	for (const field of template.fields) {
		const {
			name,
			type,
			defaultValue,
			required,
			fixed
		} = field;

		const matches = values.filter(v => v.name === name);
		if (matches.length > 1)
			return res.status(statusCode.BAD_REQUEST).send(`Duplicate values for the field '${name}' received!`);

		const newField = matches[0];

		// Check if required and missing
		if (
			(newField == null || newField.value == null)
			&& required
			&& defaultValue == null
		)
			return res.status(statusCode.BAD_REQUEST).send(`Received no value for field '${name}'!`);
			
		if (newField == null || fixed)
			continue;
		
		let { value: newValue } = newField ?? {};
		
		switch (type) {
			case 'Number': {
				if (typeof newValue !== 'number')
					return res.status(statusCode.BAD_REQUEST).send(`Only numbers accepted for '${name}'!`);
			}
			break;
			case 'String': {
				if (typeof newValue !== 'string')
					return res.status(statusCode.BAD_REQUEST).send(`Only strings accepted for '${name}'!`);
			}
			break;
			case 'Boolean': {
				if (typeof newValue !== 'boolean')
					return res.status(statusCode.BAD_REQUEST).send(`Only booleans accepted for '${name}'!`);
			}
			break;
			case 'Date': {
				if (newValue === 'now')
					newValue = new Date(Date.now());
				try {
					new Date(Date.parse(newValue)).toISOString();
				} catch(e) {
					return res.status(statusCode.BAD_REQUEST).send(`Invalid value for field '${name}': Invalid date! Use the UTC/ISO format.`);
				}
			}
			break;
			case 'Image': {
				if (newValue != null && !await validateImage(newValue))
					return res.status(statusCode.BAD_REQUEST).send(`Invalid value for field '${name}': Image not found!`);
				
				if (newValue != null) {
					const imgLocation = await getImageLocation(newValue);
					if (!imgLocation)
						return res.status(statusCode.BAD_REQUEST).send(`Invalid value for field '${name}': Image not accessible!`);
					
					newValue = imgLocation;
				}
			}
			break;
		}

		validValues.push({
			name,
			value: newValue
		});
	}

	body.values = validValues;

	return true;
};

/**
 * For creating a new certificate
 * @type {RequestHandler}
 */
const naveen = async (req, res) => {
	const body = { ...req.body };

	if (!body.template) return res.status(statusCode.BAD_REQUEST).send(`Template not specified!`);
	if (!body.values) body.values = [];

	try {
		if (!await validateAndDoSomething(req, res, body) === true)
			return;
		const certificate = new Certificate(body);
		await certificate.save();
		res.status(statusCode.CREATED).json({
			msg: `Certificate created!`,
			data: certificate
		});
	} catch(e) {
		console.log(`Failed to create certificate: ${e}`);
		console.log(e.stack);
		res.status(statusCode.BAD_REQUEST).send(`Failed to create certificate: Bad format (${e.message.substr(0, 120)})!`);
	}
};

/**
 * For retrieving an existing certificate
 * @type {RequestHandler}
 */
const getSingle = async (req, res) => {
	const { uid } = req.params;

	const certificate = await Certificate.findOne({ uid });
	if (certificate == null)
		return res.status(statusCode.NOT_FOUND).send(`Certificate not found!`);

	return res.status(statusCode.OK).json({
		msg: `Certificate found!`,
		data: certificate
	});
};

/**
 * For getting all available certificates
 * @type {RequestHandler}
 */
 const getAll = async (req, res) => {
	const certificates = (await Certificate.find({}, {
		_id: 0,
		uid: 1
	})).map(t => t.uid);

	return res.status(statusCode.OK).json({
		msg: `${certificates.length} certificate(s) found!`,
		count: certificates.length,
		data: certificates
	});
};

/**
 * For deleting a certificate
 * @type {RequestHandler}
 */
 const deleteSingle = async (req, res) => {
	const { uid } = req.params;
	const certificate = await Certificate.findOne({ uid });

	if (certificate == null)
		return res.status(statusCode.NOT_FOUND).send(`Certificate not found: ${uid}`);
	
	try {
		const deleted = await certificate.delete();
		return res.status(statusCode.OK).json({
			msg: `Certificate deleted!`,
			data: certificate
		});
	} catch(e) {
		console.log(`Failed to delete certificate '${uid}': ${e.message}`);
		console.log(e.stack);
		return res.status(statusCode.INTERNAL_SERVER_ERROR).json(`Failed to delete certificate '${uid}'.`);
	}
};

/**
 * For deleting multiple certificates
 * @type {RequestHandler}
 */
const deleteMultiple = async (req, res) => {
	const certificates = (await Certificate.find({}, {
		uid: 1,
		_id: 0
	})).map(f => f.uid);

	try {
		const deleted = await Certificate.deleteMany({});
		return res.status(statusCode.OK).json({
			msg: `All certificates deleted!`,
			data: certificates,
			count: certificates.length
		});
	} catch(e) {
		console.log(`Failed to delete certificates: ${e.message}`);
		console.log(e.stack);
		return res.status(statusCode.INTERNAL_SERVER_ERROR).json(`Failed to delete certificates.`);
	}
};

/**
 * For updating a certificate
 * @type {RequestHandler}
 */
const patch = async (req, res) => {
	const { uid } = req.params;

	const certificate = await Certificate.findOne({ uid });
	if (certificate == null)
		return res.status(statusCode.NOT_FOUND).send(`Certificate not found!`);

	const template = await Template.findOne({ name: certificate.template });
	if (template == null) {
		await certificate.delete();
		return res.status(statusCode.NOT_FOUND).send(`Certificate not found!`);
	}

	const body = { ...req.body };

	if (body.title == null) body.title = certificate.title;
	if (body.template) delete body.template;
	if (body.uid) delete body.uid;
	if (!body.values) body.values = [];

	const existingValues = certificate.values.map(v => v.name);
	const newValues = body.values.filter(v => v?.name != null && v?.value != null).filter(v => existingValues.indexOf(v.name) < 0);
	const updatedOldValues = body.values.filter(v => v?.name != null && v?.value != null).filter(v => existingValues.indexOf(v.name) >= 0);
	body.values = [
		...updatedOldValues,
		...newValues
	];
	body.template = template.name;

	try {
		if (!await validateAndDoSomething(req, res, body) === true)
			return;
		const certificate = await Certificate.findOneAndUpdate({
			uid
		}, { $set: body }, {
			useFindAndModify: true,
			new: true
		});
		res.status(statusCode.OK).json({
			data: certificate,
			msg: `Certificate updated!`
		});
	} catch(e) {
		console.log(`Failed to update certificate: ${e}`);
		console.log(e.stack);
		res.status(statusCode.BAD_REQUEST).send(`Failed to update certificate: Bad format (${e.message.substr(0, 120)})!`);
	}
};

/**
 * For rendering a certificate
 * @type {RequestHandler}
 */
const renderCertificate = async (req, res) => {
	const { uid } = req.params;
	const format = Object.keys(req.query).indexOf('pdf') >= 0 ? 'pdf' : 'png';
	const download = Object.keys(req.query).indexOf('download') >= 0;
	const certificate = await Certificate.findOne({ uid });
	if (certificate == null)
		return res.status(statusCode.NOT_FOUND).send(`Certificate not found: ${uid}`);
	
	const template = await Template.findOne({ name: certificate.template });
	if (template == null) {
		await certificate.delete();
		return res.status(statusCode.NOT_FOUND).send(`Certificate not found: ${uid}`);
	}

	let renderObj = {
		...template._doc
	};

	const providedValues = certificate.values.map(v => v.name);

	for (let f of renderObj.fields) {
		if (providedValues.indexOf(f.name) < 0) {
			if (f.defaultValue == null && f.value == null)
				f.skip = true;
			continue;
		}

		const v = certificate.values.filter(v => v.name === f.name)[0];
		f.value = v.value;
	}

	try {
		const can = await render(renderObj, format);

		if (format === 'pdf') {
			const buf = can.toBuffer('application/pdf', {
				title: certificate.title,
				creator: 'Rema © Param Siddharth'
			});

			if (download) {
				const fileName = sanitizeFileName(`certificate-${nanoid(10)}.pdf`);
				res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
			}
			return res.contentType('pdf').send(buf);
		}

		const buf = can.toBuffer('image/png');

		if (download) {
			const fileName = sanitizeFileName(`certificate-${nanoid(10)}.png`);
			res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
		}
		res.contentType('png').send(buf);
	} catch(e) {
		console.log(`Failed to render: ${e.message}`);
		console.log(e.stack);
		return res.status(statusCode.INTERNAL_SERVER_ERROR).send(`Failed to generate preview: ${e.message}`);
	}
};

module.exports = {
	naveen,
	getSingle,
	getAll,
	patch,
	renderCertificate,
	deleteSingle,
	deleteMultiple
};