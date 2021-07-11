const path = require('path');
const fs = require('fs-extra');
const { RequestHandler, Request, Response } = require('express');
const { statusCode } = require('statushttp');
const { nanoid } = require('nanoid');
const { createCanvas, loadImage } = require('canvas');

const Template = require('../models/template');
const {
	INTERNAL_STATIC_DIR
} = require('../constants');
const {
	validateImage,
	getImageLocation
} = require('../helpers/image');

/**
 * @callback templatePostValidationCallBack
 * @param {Request} req
 * @param {Response} res
 * @param {Object} body
 */
/**
 * Validate and do something
 * @param {Request} req
 * @param {Response} res
 * @param {Object} body
 * @param {templatePostValidationCallBack} cb
 */
const validateAndDoSomething = async (req, res, body, cb) => {
	if (!await validateImage(body.background))
		return res.status(statusCode.BAD_REQUEST).send(`Invalid value for certificate background: Image not found!`);

	for (const field of body.fields) {
		if (['Number', 'Boolean', 'String', 'Image', 'Date'].indexOf(field.type) < 0)
			return res.status(statusCode.BAD_REQUEST).send(`Invalid type for field '${field.name}': Only Number, Boolean, String, Image, and Date allowed.`);
		
		if (field.type === 'Image') {
			if (field.image == null)
				return res.status(statusCode.BAD_REQUEST).send(`Invalid value for field '${field.name}': An expected size must be defined.`);

			const { value } = field?.image ?? {};
			if (value != null && !await validateImage(value))
				return res.status(statusCode.BAD_REQUEST).send(`Invalid type for field '${field.name}': Image not found!`);
		}

		if (field.fixed && field.value == null)
			return res.status(statusCode.BAD_REQUEST).send(`Fixed field '${field.name}' cannot have an empty value.`);
	}

	await cb(req, res, body);
};

/**
 * Validate and create new template
 * @param {Request} req
 * @param {Response} res
 * @param {Object} body
 */
const validateAndCreateNewTemplate = async (req, res, body) => {
	await validateAndDoSomething(req, res, body, async (req, res, body) => {
		try {
			const template = new Template(body);
			await template.save();
			res.status(statusCode.CREATED).json({
				data: template,
				msg: `Template created!`
			});
		} catch(e) {
			console.log(`Failed to create template: ${e}`);
			console.log(e.stack);
			res.status(statusCode.INTERNAL_SERVER_ERROR).send(`Failed to create template: ${e.message}`);
		}
	});
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
	const templates = (await Template.find({}, {
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
 * For deleting a new template
 * @type {RequestHandler}
 */
 const deleteSingle = async (req, res) => {
	const { name } = req.params;
	const template = await Template.findOne({ name });

	if (template == null)
		return res.status(statusCode.NOT_FOUND).send(`Template not found: ${name}`);
	
	try {
		const deleted = await template.delete();
		return res.status(statusCode.OK).json({
			msg: `Template deleted!`,
			data: template
		});
	} catch(e) {
		console.log(`Failed to delete template '${name}': ${e.message}`);
		console.log(e.stack);
		return res.status(statusCode.INTERNAL_SERVER_ERROR).json(`Failed to delete tenplate '${name}'.`);
	}
};

/**
 * For deleting multiple templates
 * @type {RequestHandler}
 */
 const deleteMultiple = async (req, res) => {
	const templates = (await Template.find({}, {
		name: 1,
		_id: 0
	})).map(f => f.name);

	try {
		const deleted = await Template.deleteMany({});
		return res.status(statusCode.OK).json({
			msg: `All templates deleted!`,
			data: templates,
			count: templates.length
		});
	} catch(e) {
		console.log(`Failed to delete template '${name}': ${e.message}`);
		console.log(e.stack);
		return res.status(statusCode.INTERNAL_SERVER_ERROR).json(`Failed to delete tenplate '${name}'.`);
	}
};

/**
 * For generating a template's preview
 * @type {RequestHandler}
 */
 const preview = async (req, res) => {
	const { name } = req.params;
	const pdf = Object.keys(req.query).indexOf('pdf') >= 0;
	const template = await Template.findOne({ name });

	if (template == null)
		return res.status(statusCode.NOT_FOUND).send(`Template not found: ${name}`);
	
	const {
		x: width,
		y: height
	} = template.dimensions;

	let can;
	
	if (pdf)
		can = createCanvas(width, height, 'pdf');
	else
		can = createCanvas(width, height);
	
	const ctx = can.getContext('2d');

	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, width, height);

	try {
		const bgImg = await loadImage(await getImageLocation(template.background));
		ctx.drawImage(bgImg, 0, 0);
	} catch(e) {}

	for (const field of template.fields) {
		ctx.fillStyle = null;
		ctx.strokeStyle = null;
		ctx.font = null;
		ctx.textAlign = null;
		ctx.textDrawingMode = null;
		if (field.type === 'String' || field.type === 'Number') {
			let {
				fontSize,
				fontFamily,
				align,
				selectable
			} = field.textFormat;
			if (typeof fontSize === 'number') fontSize += 'px';
			ctx.font = `${fontSize} ${fontFamily}`;
			
			if (align) {
				if (align === 'centre')
					align = 'center';
				ctx.textAlign = align;
			}

			if (selectable)
				ctx.textDrawingMode = 'glyph';
			else
				ctx.textDrawingMode = 'path';

			const { style } = field.textFormat;
			if (style.type === 'colour')
				ctx.fillStyle = style.colour.value;

			const { x, y } = field.position;
			const value = field.defaultValue || field.name;
			ctx.fillText(value, x, y);
		}
	}

	if (pdf) {
		const buf = can.toBuffer('application/pdf', {
			title: 'Certificate',
			creator: 'Param Siddharth'
		});
		// res.setHeader('Content-Disposition', `attachment; filename=certificate-${nanoid(10)}.pdf`);
		return res.contentType('pdf').send(buf);
	}

	const buf = can.toBuffer('image/png');
	// res.setHeader('Content-Disposition', `attachment; filename=certificate-${nanoid(10)}.png`);
	res.contentType('png').send(buf);
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

	await validateAndCreateNewTemplate(req, res, body);
};

/**
 * For extending an existing template
 * @type {RequestHandler}
 */
 const patch = async (req, res) => {
	const { name } = req.params;
	const oldTemplate = await Template.findOne({ name });

	if (oldTemplate == null)
		return res.status(statusCode.NOT_FOUND).send(`Template not found: ${name}`);
	
	if (!req.body.name) req.body.name = name;
	
	let oldBody = { ...oldTemplate._doc };
	if (oldBody._id) delete oldBody._id;

	const { body: reqBody } = req;

	for (const docField in reqBody) {
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

	await validateAndDoSomething(req, res, body, async (req, res, body) => {
		try {
			const template = await Template.findOneAndUpdate({
				name
			}, { $set: body }, {
				useFindAndModify: true,
				new: true
			});
			res.status(statusCode.OK).json({
				data: template,
				msg: `Template updated!`
			});
		} catch(e) {
			console.log(`Failed to update template: ${e}`);
			console.log(e.stack);
			return res.status(statusCode.INTERNAL_SERVER_ERROR).send(`Failed to update template: ${e.message}`);
		}
	});
};

module.exports = {
	naveen,
	getSingle,
	getAll,
	deleteSingle,
	deleteMultiple,
	extend,
	preview,
	patch
};