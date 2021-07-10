const path = require('path');
const fs = require('fs-extra');
const { RequestHandler } = require('express');
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

	if (!await validateImage(body.background))
		return res.status(statusCode.BAD_REQUEST).send(`Invalid value for certificate background: Image not found!`);

	for (const field of body.fields) {
		if (['Number', 'Boolean', 'String', 'Image', 'Date'].indexOf(field.type) < 0)
			return res.status(statusCode.BAD_REQUEST).send(`Invalid type for field '${field.name}': Only Number, Boolean, String, Image, and Date allowed.`);
		
		if (field.type === 'Image') {
			const { src } = field?.image;
			if (src != null && !await validateImage(src))
				return res.status(statusCode.BAD_REQUEST).send(`Invalid type for field '${field.name}': Image not found!`);
		}
	}
		
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
		return res.status(statusCode.INTERNAL_SERVER_ERROR).send(`Failed to create template: ${e.message}`);
	}
};

/**
 * For creating a new template
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
}

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
		const bgImg = await loadImage(getImageLocation(template.background));
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

module.exports = {
	naveen,
	getSingle,
	preview
};