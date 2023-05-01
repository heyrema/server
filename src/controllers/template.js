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
const {
	isValidPlaceholder
} = require('../helpers/placeholder');

/**
 * Get the valid version
 * @param {Object} body
 */
const validate = async body => {
	if (!await validateImage(body.background))
		throw new Error(`Invalid value for certificate background: Image not found!`);
	
	const imgLocation = await getImageLocation(body.background);
	if (!imgLocation)
		throw new Error(`Invalid value for background: Image not accessible!`);
	
	body.background = imgLocation;

	if (body.fields == null)
		throw new Error(`Invalid value for fields!`);

	for (const field of body.fields) {
		if (body.fields.filter(f => f.name === field.name).length > 1)
			throw new Error(`Duplicate fields named '${field.name}' received!`);

		if (field.type == null)
			field.type = 'String';

		if (['Number', 'Boolean', 'String', 'Image', 'Date', 'QR'].indexOf(field.type) < 0)
			throw new Error(`Invalid type for field '${field.name}': Only Number, Boolean, String, Image, Date, and QR allowed.`);
		
		if (['TITLE', 'template', 'uid', '_id'].indexOf(field.name) >= 0)
			throw new Error(`Invalid name for field '${field.name}': Name not allowed for fields.`);

		if ((field.fixed || field.placeholder) && field.value == null)
			throw new Error(`Fixed field '${field.name}' cannot have an empty value.`);

		if (field.placeholder)
			if (!isValidPlaceholder(field))
				throw new Error(`Field '${field.name}' is an invalid placeholder!`);
			else
				continue;

		if (field.type === 'Image') {
			if (field.image == null)
				throw new Error(`Invalid value for field '${field.name}': An expected size must be defined.`);

			const { value, defaultValue } = field ?? {};
			if (value != null && !await validateImage(value))
				throw new Error(`Invalid value for field '${field.name}': Image not found!`);
			
			if (value != null) {
				const imgLocation = await getImageLocation(value);
				if (!imgLocation)
					throw new Error(`Invalid value for field '${field.name}': Image not accessible!`);
				
				field.value = imgLocation;
			}

			if (defaultValue != null && !await validateImage(defaultValue))
				throw new Error(`Invalid default value for field '${field.name}': Image not found!`);
			
			if (defaultValue != null) {
				const imgLocation = await getImageLocation(defaultValue);
				if (!imgLocation)
					throw new Error(`Invalid default value for field '${field.name}': Image not accessible!`);
				
				field.defaultValue = imgLocation;
			}
		} else if (field.type === 'QR') {
			if (field.qr == null)
				throw new Error(`Invalid value for field '${field.name}': An expected size must be defined.`);
		} else {
			if (field.textFormat == null)
				field.textFormat = {};

			// Text fields
			const {
				style
			} = field.textFormat;

			if (style != null && style?.type == 'gradient' && (style.gradient == null || style.gradient.stops?.length < 2))
				throw new Error(`Invalid style for field '${field.name}': Invalid gradient configuration!`);
		}

		if (field.type === 'Date') {
			const { value, defaultValue } = field ?? {};

			if (value != null) {
				if (value === 'now') {
					field.value = new Date(Date.now());
				} else {
					try {
						new Date(Date.parse(value)).toISOString();
					} catch(e) {
						throw new Error(`Invalid value for field '${field.name}': Invalid date! Use the UTC/ISO format.`);
					}
				}
			}

			if (defaultValue != null) {
				if (defaultValue === 'now') {
					field.defaultValue = new Date(Date.now());
				} else {
					try {
						new Date(Date.parse(defaultValue)).toISOString();
					} catch(e) {
						throw new Error(`Invalid value for field '${field.name}': Invalid date! Use the UTC/ISO format.`);
					}
				}
			}
		}
	}
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
 * Validate and create new template
 * @param {Request} req
 * @param {Response} res
 * @param {Object} body
 */
const validateAndCreateNewTemplate = async (req, res, body) => {
	try {
		if (await validateAndDoSomething(req, res, body) !== true)
			return;
		const template = new Template(body);
		await template.save();
		res.status(statusCode.CREATED).json({
			data: template,
			msg: `Template created!`
		});
	} catch(e) {
		console.error(`Failed to create template: ${e}`);
		console.error(e.stack);
		res.status(statusCode.BAD_REQUEST).send(`Failed to create template: Bad format (${e.message.substr(0, 120)})!`);
	}
};

/**
 * For creating a new template
 * @type {RequestHandler}
 */
const naveen = async (req, res) => {
	let body = { ...req.body };

	if (!body.name) body.name = nanoid();
	if (!body.title) body.title = body.name;
	if (!body.background) return res.status(statusCode.BAD_REQUEST).send(`Background required!`);
	if (!body.dimensions) return res.status(statusCode.BAD_REQUEST).send(`Dimensions required!`);

	const existingTemplate = await Template.findOne({ name: body.name });
	if (existingTemplate != null)
		return res.status(statusCode.CONFLICT).send(`Template '${body.name}' already exists!`);

	await validateAndCreateNewTemplate(req, res, body);
};

/**
 * For getting a template
 * @type {RequestHandler}
 */
const getSingle = async (req, res) => {
	const { name } = req.params;
	const template = await Template.findOne({ name });

	if (template == null)
		return res.status(statusCode.NOT_FOUND).send(`Template not found: ${name}`);
	
	return res.status(statusCode.OK).json({
		msg: `Template found!`,
		data: template
	});
};

/**
 * For getting all available templates
 * @type {RequestHandler}
 */
const getAll = async (req, res) => {
	if(req.query.tags){
		try{
		const formData = req.query.tags;
		const decodedData = decodeURIComponent(formData);
		const jsonObject = JSON.parse(decodedData);
		req.query['tags'] = {'$in': jsonObject};
		}catch(e){
			return res.status(statusCode.BAD_REQUEST).send(`Failed to get templates: Bad fromat ${e.message}`);
		}
	}

	const templates = (await Template.find(req.query, {
		_id: 0,
		name: 1
	})).map(t => t.name);

	return res.status(statusCode.OK).json({
		msg: `${templates.length} template(s) found!`,
		count: templates.length,
		data: templates
	});
};

/**
 * For deleting a template
 * @type {RequestHandler}
 */
const deleteSingle = async (req, res) => {
	const { name } = req.params;
	const force = Object.keys(req.query).indexOf('force') >= 0;
	const template = await Template.findOne({ name });

	if (template == null)
		return res.status(statusCode.NOT_FOUND).send(`Template not found: ${name}`);

	const certificates = await Certificate.find({ template: name });

	if (certificates.length > 0 && !force)
		return res.status(statusCode.NOT_ACCEPTABLE).send(`Cannot delete template with one or multiple certificates. Use the query parameter 'force' to bypass.`);
	
	try {
		certificates.map(async c => await c.delete());
		const deleted = await template.delete();
		return res.status(statusCode.OK).json({
			msg: `Template deleted!`,
			data: {
				template,
				certificates: certificates.map(c => c.uid)
			},
			count: {
				templates: 1,
				certificates: certificates.length
			}
		});
	} catch(e) {
		console.error(`Failed to delete template '${name}': ${e.message}`);
		console.error(e.stack);
		return res.status(statusCode.INTERNAL_SERVER_ERROR).json(`Failed to delete template '${name}'.`);
	}
};

/**
 * For deleting multiple templates
 * @type {RequestHandler}
 */
const deleteMultiple = async (req, res) => {
	const unused = Object.keys(req.query).indexOf('unused') >= 0;
	const force = Object.keys(req.query).indexOf('force') >= 0;
	const templates = await Template.find({});
	const certificates = await Certificate.find({});

	if (certificates.length > 0 && !force && !unused)
		return res.status(statusCode.NOT_ACCEPTABLE).send(`Cannot delete templates with one or multiple certificates. Use the query parameter 'force' to bypass, or use 'unused' to delete only unused templates.`);

	try {
		if (unused && !force) {
			const used = new Set();
			certificates.map(c => used.add(c.template));
			const unusedTemplates = templates.filter(t => !used.has(t.name));
			unusedTemplates.map(async t => await t.delete());
			return res.status(statusCode.OK).json({
				msg: `All unused templates deleted!`,
				data: {
					templates: unusedTemplates.map(t => t.name)
				},
				count: {
					templates: unusedTemplates.length
				}
			});
		}
		certificates.map(async c => await c.delete());
		const deleted = await Template.deleteMany({});
		return res.status(statusCode.OK).json({
			msg: `All templates deleted!`,
			data: {
				templates: templates.map(t => t.name),
				certificates: certificates.map(c => c.uid)
			},
			count: {
				templates: templates.length,
				certificates: certificates.length
			}
		});
	} catch(e) {
		console.error(`Failed to delete templates: ${e.message}`);
		console.error(e.stack);
		return res.status(statusCode.INTERNAL_SERVER_ERROR).json(`Failed to delete templates.`);
	}
};

/**
 * For generating a template's preview
 * @type {RequestHandler}
 */
const preview = async (req, res) => {
	const { name } = req.params;
	const format = Object.keys(req.query).indexOf('pdf') >= 0 ? 'pdf' : 'png';
	const download = Object.keys(req.query).indexOf('download') >= 0;
	const template = await Template.findOne({ name });

	if (template == null)
		return res.status(statusCode.NOT_FOUND).send(`Template not found: ${name}`);
	
	try {
		const can = await render({
			...template._doc,
			templateTitle: template.title,
			templateDate: template.date,
			uid: 'Sample UID'
		}, format);

		if (format === 'pdf') {
			const buf = can.toBuffer('application/pdf', {
				title: template.title,
				creator: 'Rema © Param Siddharth'
			});

			if (download) {
				const fileName = sanitizeFileName(`template-${nanoid(10)}.pdf`);
				res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
			}
			return res.contentType('pdf').send(buf);
		}

		const buf = can.toBuffer('image/png');
		
		if (download) {
			const fileName = sanitizeFileName(`template-${nanoid(10)}.png`);
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
 * For extending an existing template
 * @type {RequestHandler}
 */
const extend = async (req, res) => {
	const { name } = req.params;
	const oldTemplate = await Template.findOne({ name });

	if (oldTemplate == null)
		return res.status(statusCode.NOT_FOUND).send(`Template not found: ${name}`);
	
	if (!req.body.name) req.body.name = nanoid();
	
	let oldBody = { ...oldTemplate._doc };
	if (oldBody._id) delete oldBody._id;

	const { body: reqBody } = req;

	for (const docField in reqBody) {
		if (docField !== 'name' && docField.delete) {
			delete oldBody[docField];
			continue;
		}

		if (docField === 'name') {
			const { name: newName } = reqBody;
			const existingTemplate = await Template.findOne({ name: newName });

			if (existingTemplate != null)
				return res.status(statusCode.CONFLICT).send(`Template '${newName}' already exists!`);
			
			oldBody.name = newName;
		} else if (docField === 'fields') {
			for (const field of reqBody.fields) {
				if (field.delete) {
					oldBody.fields = oldBody.fields.filter(f => f.name !== field.name);
					continue;
				}
				
				const existingField = oldBody.fields.filter(f => f.name === field.name)[0];
				
				if (existingField == null)
					oldBody.fields.push(field);
				else if (!existingField.fixed || field.force) {
					oldBody.fields = oldBody.fields.filter(f => f.name !== field.name);

					let newBody = {
						...existingField._doc,
						...field
					};

					const objFields = [
						'textFormat',
						'image',
						'qr'
					];
					for (const objField of objFields)
						if (existingField[objField] != null && field[objField] != null)
							newBody[objField] = {
								...existingField._doc[objField]?.toJSON(),
								...field[objField]
							};

					oldBody.fields.push(newBody);
				}
			}
		} else
			oldBody[docField] = reqBody[docField];
	}

	let body = oldBody;

	if (!body.title) body.title = body.name;
	if (!body.background) return res.status(statusCode.BAD_REQUEST).send(`Background required!`);
	if (!body.dimensions) return res.status(statusCode.BAD_REQUEST).send(`Dimensions required!`);

	await validateAndCreateNewTemplate(req, res, body);
};

/**
 * For updating an existing template
 * @type {RequestHandler}
 */
const patch = async (req, res) => {
	const { name } = req.params;
	const force = Object.keys(req.query).indexOf('force') >= 0;
	const keep = Object.keys(req.query).indexOf('keep') >= 0;
	const oldTemplate = await Template.findOne({ name });

	if (oldTemplate == null)
		return res.status(statusCode.NOT_FOUND).send(`Template not found: ${name}`);

	const certificates = await Certificate.find({ template: name });

	if (certificates.length > 0 && !force)
		return res.status(statusCode.NOT_ACCEPTABLE).send(`Cannot modify template with one or multiple certificates. Use the query parameter 'force' to bypass.`);
	
	if (!req.body.name) req.body.name = name;
	
	let oldBody = { ...oldTemplate._doc };
	if (oldBody._id) delete oldBody._id;

	const { body: reqBody } = req;

	for (const docField in reqBody) {
		if (!keep)
			certificates.map(async c => await c.delete());

		if (docField !== 'name' && docField.delete) {
			delete oldBody[docField];
			continue;
		}

		if (docField === 'name')
			oldBody.name = reqBody.name;
		else if (docField === 'fields') {
			for (const field of reqBody.fields) {
				if (field.delete) {
					oldBody.fields = oldBody.fields.filter(f => f.name !== field.name);
					continue;
				}
				
				const existingField = oldBody.fields.filter(f => f.name === field.name)[0];
				
				if (existingField == null)
					oldBody.fields.push(field);
				else if (!existingField.fixed || field.force) {
					oldBody.fields = oldBody.fields.filter(f => f.name !== field.name);
					
					let newBody = {
						...existingField._doc,
						...field
					};

					const objFields = [
						'textFormat',
						'image'
					];
					for (const objField of objFields)
						if (existingField[objField] != null && field[objField] != null)
							newBody[objField] = {
								...existingField._doc[objField]?.toJSON(),
								...field[objField]
							};

					oldBody.fields.push(newBody);
				}
			}
		} else
			oldBody[docField] = reqBody[docField];
	}

	let body = oldBody;

	if (!body.title) body.title = body.name;
	if (!body.background) return res.status(statusCode.BAD_REQUEST).send(`Background required!`);
	if (!body.dimensions) return res.status(statusCode.BAD_REQUEST).send(`Dimensions required!`);

	try {
		if (await validateAndDoSomething(req, res, body) !== true)
			return;
		const template = await Template.findOneAndUpdate({
			name
		}, { $set: body }, {
			useFindAndModify: false,
			new: true
		});
		res.status(statusCode.OK).json({
			data: template,
			msg: `Template updated!`
		});
	} catch(e) {
		console.error(`Failed to update template: ${e}`);
		console.error(e.stack);
		return res.status(statusCode.INTERNAL_SERVER_ERROR).send(`Failed to update template: ${e.message}`);
	}
};

/**
 * Exporting templates
 * @type {RequestHandler}
 */
const exportTemplate = async (req, res) => {
	const { name } = req.params;
	const plain = 'plain' in req.query;
	const template = await Template.findOne({ name });

	if (template == null)
		return res.status(statusCode.NOT_FOUND).send(`Template not found: ${name}`);
	
	const exportedObj = { ...template._doc };
	const propsToPrune = [
		'_id',
		'__v'
	];
	for (const prop of propsToPrune)
		if (exportedObj[prop]) delete exportedObj[prop];
	
	try {
		if (!plain)
			exportedObj.background = await imgToBase64(exportedObj.background);
	} catch(e) {
		const msg = `Failed to export template '${name}': Unable to export background (${e.message})!`;
		console.error(msg);
		console.error(e.stack);
		return res.status(statusCode.INTERNAL_SERVER_ERROR).send(msg);
	}

	for (const field of exportedObj.fields) {
		if (field.type !== 'Image' || plain)
			continue;

		try {
			if (field.value != null)
				field.value = await imgToBase64(field.value);

			if (field.defaultValue != null)
				field.defaultValue = await imgToBase64(field.defaultValue);
		} catch(e) {
			const msg = `Failed to export template '${name}': Unable to export field '${field.name}' (${e.message})!`;
			console.error(msg);
			console.error(e.stack);
			return res.status(statusCode.INTERNAL_SERVER_ERROR).send(msg);
		}
	}

	const fileName = sanitizeFileName(`template-${name}-${nanoid(10)}.json`)
	
	res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
	return res.status(statusCode.OK).json(exportedObj);
};

module.exports = {
	naveen,
	getSingle,
	getAll,
	deleteSingle,
	deleteMultiple,
	extend,
	preview,
	patch,
	exportTemplate
};