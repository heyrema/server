const path = require('path');
const fs = require('fs-extra');
const { RequestHandler, Request, Response } = require('express');
const { statusCode } = require('statushttp');
const { nanoid } = require('nanoid');
const { createCanvas, loadImage } = require('canvas');
const strftime = require('strftime');

const Template = require('../models/template');
const {
	INTERNAL_STATIC_DIR,
	MAX_CAIRO_DIMENSION,
	SINGLE_WHITE_PIXEL
} = require('../constants');
const {
	validateImage,
	getImageLocation
} = require('../helpers/image');

/**
 * Validate and do something
 * @param {Request} req
 * @param {Response} res
 * @param {Object} body
 */
const validateAndDoSomething = async (req, res, body) => {
	if (!await validateImage(body.background))
		return res.status(statusCode.BAD_REQUEST).send(`Invalid value for certificate background: Image not found!`);
	
	const imgLocation = await getImageLocation(body.background);
	if (!imgLocation)
		return res.status(statusCode.BAD_REQUEST).send(`Invalid value for background: Image not accessible!`);
	
	body.background = imgLocation;

	for (const field of body.fields) {
		if (['Number', 'Boolean', 'String', 'Image', 'Date'].indexOf(field.type) < 0)
			return res.status(statusCode.BAD_REQUEST).send(`Invalid type for field '${field.name}': Only Number, Boolean, String, Image, and Date allowed.`);
		
		if (field.type === 'Image') {
			if (field.image == null)
				return res.status(statusCode.BAD_REQUEST).send(`Invalid value for field '${field.name}': An expected size must be defined.`);

			const { value, defaultValue } = field ?? {};
			if (value != null && !await validateImage(value))
				return res.status(statusCode.BAD_REQUEST).send(`Invalid value for field '${field.name}': Image not found!`);
			
			if (value != null) {
				const imgLocation = await getImageLocation(value);
				if (!imgLocation)
					return res.status(statusCode.BAD_REQUEST).send(`Invalid value for field '${field.name}': Image not accessible!`);
				
				field.value = imgLocation;
			}

			if (defaultValue != null && !await validateImage(defaultValue))
				return res.status(statusCode.BAD_REQUEST).send(`Invalid default value for field '${field.name}': Image not found!`);
			
			if (defaultValue != null) {
				const imgLocation = await getImageLocation(defaultValue);
				if (!imgLocation)
					return res.status(statusCode.BAD_REQUEST).send(`Invalid default value for field '${field.name}': Image not accessible!`);
				
				field.defaultValue = imgLocation;
			}
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
						return res.status(statusCode.BAD_REQUEST).send(`Invalid value for field '${field.name}': Invalid date! Use the UTC/ISO format.`);
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
						return res.status(statusCode.BAD_REQUEST).send(`Invalid value for field '${field.name}': Invalid date! Use the UTC/ISO format.`);
					}
				}
			}
		}

		if (field.fixed && field.value == null)
			return res.status(statusCode.BAD_REQUEST).send(`Fixed field '${field.name}' cannot have an empty value.`);
	}

	return true;
};

/**
 * Validate and create new template
 * @param {Request} req
 * @param {Response} res
 * @param {Object} body
 */
const validateAndCreateNewTemplate = async (req, res, body) => {
	try {
		await validateAndDoSomething(req, res, body);
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
	
	try {
		let {
			x: width,
			y: height
		} = template.dimensions;

		if (width > MAX_CAIRO_DIMENSION || height > MAX_CAIRO_DIMENSION) {
			const ratio = width / height;

			if (width > height) {
				console.log('Trimming width', width, MAX_CAIRO_DIMENSION);
				const oldDim = width;
				const conversion = MAX_CAIRO_DIMENSION / oldDim;
				width = MAX_CAIRO_DIMENSION;
				height = width / ratio;

				for (const field of template.fields) {
					field.position.x *= conversion;
					field.position.y *= conversion;

					if (field.textFormat != null)
						field.textFormat.fontSize *= conversion;
					else if (field.image != null) {
						field.image.expectedSize.x *= conversion;
						field.image.expectedSize.y *= conversion;
					}
				}
			} else {
				console.log('Trimming height', height, MAX_CAIRO_DIMENSION);
				const oldDim = height;
				const conversion = MAX_CAIRO_DIMENSION / oldDim;
				height = MAX_CAIRO_DIMENSION;
				width = height * ratio;

				for (const field of template.fields) {
					field.position.x *= conversion;
					field.position.y *= conversion;

					if (field.textFormat != null)
						field.textFormat.fontSize *= conversion;
					else if (field.image != null) {
						field.image.expectedSize.x *= conversion;
						field.image.expectedSize.y *= conversion;
					}
				}
			}

			console.log(width, height);
		}

		let can;
		
		if (pdf)
			can = createCanvas(width, height, 'pdf');
		else
			can = createCanvas(width, height);
		
		const ctx = can.getContext('2d');

		ctx.fillStyle = template.backgroundColour;
		ctx.fillRect(0, 0, width, height);

		try {
			const bgImg = await loadImage(path.join(INTERNAL_STATIC_DIR, template.background));
			ctx.drawImage(bgImg, 0, 0, width, height);
		} catch(e) {}

		for (const field of template.fields) {
			const { x, y } = field.position;

			ctx.filter = undefined;
			ctx.globalCompositeOperation = 'source-over';
			ctx.fillStyle = '#000000';
			ctx.strokeStyle = '#000000';
			ctx.font = '10px sans-serif';
			ctx.textAlign = 'start';
			ctx.textDrawingMode = 'path';
			ctx.resetTransform();

			ctx.translate(x, y);
			ctx.rotate(field.rotation * Math.PI / 180);
			ctx.translate(-x, -y);

			if (field.type === 'Image') {
				let {
					expectedSize: {
						x: width,
						y: height
					}
				} = field.image;

				let value = field.value ?? field.defaultValue;

				// Display an inversion if no value is provided
				if (value == null) {
					ctx.globalCompositeOperation = 'difference';
					ctx.fillStyle = 'white';
					value = SINGLE_WHITE_PIXEL;
				}

				const toLoad = value.startsWith('data:') ? value : path.join(INTERNAL_STATIC_DIR, value);
				const imgToDraw = await loadImage(toLoad);
				ctx.drawImage(imgToDraw, x, y, width, height);
			} else {
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
				if (style != null) {
					switch (style.type) {
						case 'colour': {
							if (style.colour.value === 'invert') {
								ctx.globalCompositeOperation = 'difference';
								ctx.fillStyle = 'white';
							} else
								ctx.fillStyle = style.colour.value;
						}
						break;
					}
				}

				switch (field.type) {
					case 'Number':
					case 'String': {
						const value = field.value ?? field.defaultValue ?? field.name;
						ctx.fillText(value, x, y);
					}
					break;
					case 'Boolean': {
						let value = field.value ?? field.defaultValue ?? '?';
						
						if (value === true)
							value = '✓';
						else if (value === false)
							value = '✕';

						ctx.fillText(value, x, y);
					}
					break;
					case 'Date': {
						let value = field.value ?? field.defaultValue ?? 'now';

						value = new Date(value);

						const format = field.dateFormat ?? '%d/%m/%Y';

						try {
							value = strftime(format, value);
						} catch(e) {
							console.log(`Failed to format date: ${e.message}`);
							console.log(e.stack);
							console.log(`Date: ${value}`);
							console.log(`Format: ${format}`);
							value = value.toISOString();
						}

						ctx.fillText(value, x, y);
					}
				}
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
	} catch(e) {
		console.log(`Failed to render: ${e.message}`);
		console.log(e.stack);
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

	try {
		await validateAndDoSomething(req, res, body);
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