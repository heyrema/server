const fs = require('fs-extra');
const csv = require('csv-parser');
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
	convertTo,
	defaultValue: getDefaultValue
} = require('../helpers/types');
const {
	render
} = require('../helpers/render');

/**
 * Get the valid version
 * @param {Object} body
 */
const validate = async body => {
	const { values } = body;

	if (values.filter(v => v?.value == null && v?.visible !== false).length > 0)
		throw new Error(`Empty values not allowed!`);

	const template = await Template.findOne({ name: body.template });
	if (template == null)
		throw new Error(`Template not found!`);
	
	const validValues = [];

	for (const field of template.fields) {
		const {
			name,
			type,
			defaultValue,
			required,
			fixed,
		} = field;

		const matches = values.filter(v => v.name === name);
		if (matches.length > 1)
			throw new Error(`Duplicate values for the field '${name}' received!`);

		const newField = matches[0];

		let visible = true;
		if ('visible' in (newField ?? {}))
			visible = newField.visible;

		if (newField?.visible === false)
			newField.value = getDefaultValue[type];

		if (field.placeholder) {
			if (visible !== false)
				continue;
				
			newField.value = field.value;
			validValues.push({ ...newField });
			continue;
		}

		// Check if required and missing
		if (
			(newField == null || newField.value == null)
			&& required
			&& defaultValue == null
		)
			throw new Error(`Received no value for field '${name}'!`);
			
		if (newField == null || fixed)
			continue;
		
		let { value: newValue } = newField ?? {};
		
		switch (type) {
			case 'Number': {
				if (typeof newValue !== 'number')
					throw new Error(`Only numbers accepted for '${name}'!`);
			}
			break;
			case 'String': {
				if (typeof newValue !== 'string')
					throw new Error(`Only strings accepted for '${name}'!`);
			}
			break;
			case 'Boolean': {
				if (typeof newValue !== 'boolean')
					throw new Error(`Only booleans accepted for '${name}'!`);
			}
			break;
			case 'Date': {
				if (newValue === 'now')
					newValue = new Date(Date.now());
				try {
					new Date(Date.parse(newValue)).toISOString();
				} catch(e) {
					throw new Error(`Invalid value for field '${name}': Invalid date! Use the UTC/ISO format.`);
				}
			}
			break;
			case 'Image': {
				if (newValue != null && !await validateImage(newValue))
					throw new Error(`Invalid value for field '${name}': Image not found!`);
				
				if (newValue != null) {
					const imgLocation = await getImageLocation(newValue);
					if (!imgLocation)
						throw new Error(`Invalid value for field '${name}': Image not accessible!`);
					
					newValue = imgLocation;
				}
			}
			break;
		}

		validValues.push({
			name,
			value: newValue,
			visible
		});
	}

	body.values = validValues;
	return body;
};

/**
 * Validate and do something
 * @param {Request} req
 * @param {Response} res
 * @param {Object} body
 */
const validateAndDoSomething = async (req, res, body) => {
	try {
		await validate(body);
		return true;
	} catch(e) {
		res.status(statusCode.BAD_REQUEST).send(e.message);
		return false;
	}
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
		if (await validateAndDoSomething(req, res, body) !== true)
			return;
		const certificate = new Certificate(body);
		await certificate.save();
		res.status(statusCode.CREATED).json({
			msg: `Certificate created!`,
			data: certificate
		});
	} catch(e) {
		console.error(`Failed to create certificate: ${e}`);
		console.error(e.stack);
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
	if(req.query.tags){
		try{
		const formData = req.query.tags;
		const decodedData = decodeURIComponent(formData);
		const jsonObject = JSON.parse(decodedData);
		req.query["tags"] = {"$in": jsonObject};
		}catch(e){
			return res.status(statusCode.BAD_REQUEST).send(`Bad JSON object encoding ${e.message}`);
		}
	}

	const certificates = (await Certificate.find(req.query, {
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
		console.error(`Failed to delete certificate '${uid}': ${e.message}`);
		console.error(e.stack);
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
		console.error(`Failed to delete certificates: ${e.message}`);
		console.error(e.stack);
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
	const updatedOldValueNames = updatedOldValues.map(v => v.name);
	const notUpdatedExistingValueNames = existingValues.filter(v => updatedOldValueNames.indexOf(v.name) < 0);
	const notUpdatedExistingValues = certificate.values.filter(v => notUpdatedExistingValueNames.indexOf(v.name) >= 0);
	body.values = [
		...notUpdatedExistingValues,
		...updatedOldValues,
		...newValues
	];
	body.template = template.name;

	console.log(body)

	try {
		if (await validateAndDoSomething(req, res, body) !== true)
			return;
		const certificate = await Certificate.findOneAndUpdate({
			uid
		}, { $set: body }, {
			useFindAndModify: false,
			new: true
		});
		res.status(statusCode.OK).json({
			data: certificate,
			msg: `Certificate updated!`
		});
	} catch(e) {
		console.error(`Failed to update certificate: ${e}`);
		console.error(e.stack);
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

	renderObj.date = certificate.date;
	renderObj.templateDate = template.date;

	renderObj.title = certificate.title;
	renderObj.templateTitle = template.title;

	renderObj.uid = certificate.uid;

	const providedValues = certificate.values.map(v => v.name);

	for (let f of renderObj.fields) {
		if (providedValues.indexOf(f.name) < 0) {
			if (f.defaultValue == null && f.value == null)
				f.skip = true;
			continue;
		}

		const v = certificate.values.filter(v => v.name === f.name)[0];
		f.value = v.value;

		if (!v.visible)
			f.skip = true;
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
		console.error(`Failed to render: ${e.message}`);
		console.error(e.stack);
		return res.status(statusCode.INTERNAL_SERVER_ERROR).send(`Failed to generate preview: ${e.message}`);
	}
};

/**
 * For rendering certificates in bulk
 * @type {RequestHandler}
 */
const bulk = async (req, res) => {
	const { file: list } = req;
	const { template, title: globalTitle } = req.body;
	const objects = Object.keys(req.query).indexOf('objects') >= 0;

	if (list == null)
		return res.status(statusCode.NOT_FOUND).send(`List not provided!`);

	const templateObj = await Template.findOne({ name: template });
	if (templateObj == null)
		return res.status(statusCode.NOT_FOUND).send(`Template not found: ${template}`);

	let items = [];

	const listReadStream = fs.createReadStream(list.path, { encoding: 'utf-8' });
	const parser = csv();

	listReadStream.pipe(parser)
		.on('data', item => items.push(item))
		.on('error', e => {
			console.error(`Error during parsing CSV: ${e.message}`);
			console.error(e.stack);
		}).on('end', async () => {
			if (fs.existsSync(list.path))
				fs.unlinkSync(list.path);
			
			let certs = [];
			
			for (const item of items) {
				['template', 'uid', '_id'].forEach(v => {
					if (v in item)
						delete item[v];
				});

				let preserve = {};
				const placs = [
					{
						plac: 'TITLE',
						prop: 'title'
					}
				];

				placs.forEach(({ plac, prop }) => {
					if (plac in item) {
						if (item[plac] !== '')
							preserve[prop] = item[plac];
						delete item[plac];
					}
				});

				let values = Object.keys(item).map(k => ({
					name: k,
					value: item[k] === '' || item[k] == null ? null : item[k]
				})).filter(i => i.value != null);

				values = values.map(v => {
					const f = templateObj.fields.filter(f => f.name === v.name)[0];
					if (f == null)
						return v;
					let { name, value } = v;
					if (f.type in convertTo && !f.placeholder)
						value = convertTo[f.type](value);
					if (value == null)
						return v;
					return { name, value };
				});

				const certObj = {
					template,
					values,
					title: globalTitle,
					...preserve
				};

				try {
					await validate(certObj);
				} catch(e) {
					console.error(e.message);
					certs.push({
						...certObj,
						error: e.message
					});
					continue;
				}

				const certificate = new Certificate(certObj);

				const valueKeys = certificate.values.map(v => v.name);
				const keysToRetain = Object.keys(item).filter(k => [
					...placs.map(p => p.plac)
				].indexOf(k) < 0 && valueKeys.indexOf(k) < 0);

				const retained = keysToRetain.map(k => ({
					name: k,
					value: item[k] === '' || item[k] == null ? null : item[k]
				}));

				try{
					await certificate.save();
				} catch(e) {
					certs.push({
						...certObj,
						retained,
						error: e.message
					});
					continue;
				}

				certs.push({
					...JSON.parse(JSON.stringify(certificate)),
					retained
				});
			}

			const resp = {
				msg: certs.filter(c => c?.error != null).length < 1 ? `Certificates generated!` : `Finished with errors.`,
				certificates: certs.filter(c => c?.error == null).map(c => c.uid),
				errors: certs.filter(c => c?.error != null),
				template
			};

			if (objects)
				return res.status(statusCode.OK).json({
					...resp,
					successful: certs.filter(c => c?.error == null)
				});

			return res.status(statusCode.OK).json(resp);
		});
};

module.exports = {
	naveen,
	getSingle,
	getAll,
	patch,
	renderCertificate,
	deleteSingle,
	deleteMultiple,
	bulk
};