const fs = require('fs-extra');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const strftime = require('strftime');

const {
	MAX_CAIRO_DIMENSION,
	SINGLE_WHITE_PIXEL
} = require('../constants');

const { getPlaceholder } = require('./placeholder');
const { resolveItemPath } = require('./resolution');
const qr = require('./qr');

// Load fonts
const loadFonts = () => {
	if (!process.env.FONTS_LOADED) {
		const RESOURCES = resolveItemPath('items.json');
		if (fs.existsSync(RESOURCES)) {
			const fonts = fs.readJSONSync(RESOURCES).filter(i => i.type === 'font');
			for (const font of fonts) {
				const {
					path: fontPath,
					family
				} = font;
				registerFont(resolveItemPath(fontPath), { family });
			}
			process.env.FONTS_LOADED = 1;
		}
	}
}

loadFonts();

// Render a preview of a template or a certificate
const render = async (cert, fmt) => {
	loadFonts();

	let {
		x: width,
		y: height
	} = cert.dimensions;

	if (width > MAX_CAIRO_DIMENSION || height > MAX_CAIRO_DIMENSION) {
		const ratio = width / height;

		if (width > height) {
			const oldDim = width;
			const conversion = MAX_CAIRO_DIMENSION / oldDim;
			width = MAX_CAIRO_DIMENSION;
			height = width / ratio;

			for (const field of cert.fields) {
				field.position.x *= conversion;
				field.position.y *= conversion;

				if (field.textFormat != null)
					field.textFormat.fontSize *= conversion;
				else if (field.image != null) {
					field.image.size.x *= conversion;
					field.image.size.y *= conversion;
				} else if (field.qr != null) {
					field.qr.size.x *= conversion;
					field.qr.size.y *= conversion;
				}
			}
		} else {
			const oldDim = height;
			const conversion = MAX_CAIRO_DIMENSION / oldDim;
			height = MAX_CAIRO_DIMENSION;
			width = height * ratio;

			for (const field of cert.fields) {
				field.position.x *= conversion;
				field.position.y *= conversion;

				if (field.textFormat != null)
					field.textFormat.fontSize *= conversion;
				else if (field.image != null) {
					field.image.size.x *= conversion;
					field.image.size.y *= conversion;
				} else if (field.qr != null) {
					field.qr.size.x *= conversion;
					field.qr.size.y *= conversion;
				}
			}
		}
	}

	let can;

	if (fmt === 'pdf')
		can = createCanvas(width, height, 'pdf');
	else
		can = createCanvas(width, height);

	const ctx = can.getContext('2d');

	if (cert.backgroundColour !== 'transparent') {
		ctx.fillStyle = cert.backgroundColour;
		ctx.fillRect(0, 0, width, height);
	}

	try {
		const bgImg = await loadImage(resolveItemPath(cert.background));
		ctx.drawImage(bgImg, 0, 0, width, height);
	} catch(e) {}

	for (const field of cert.fields) {
		if (field.skip)
			continue;

		if (field.placeholder)
			field.value = getPlaceholder(field)(cert);

		const { x, y } = field.position;

		ctx.filter = undefined;
		ctx.globalCompositeOperation = 'source-over';
		ctx.fillStyle = '#000000';
		ctx.lineWidth = 1;
		ctx.strokeStyle = '#000000';
		ctx.font = '10px sans-serif';
		ctx.textAlign = 'start';
		ctx.direction = 'ltr';
		ctx.textDrawingMode = 'path';
		ctx.resetTransform();

		ctx.translate(x, y);
		ctx.rotate(field.rotation * Math.PI / 180);
		ctx.translate(-x, -y);

		if (field.type === 'Image') {
			let {
				size: {
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

			const toLoad = value.startsWith('data:') ? value : resolveItemPath(value);
			const imgToDraw = await loadImage(toLoad);
			ctx.drawImage(imgToDraw, x, y, width, height);
		} else if (field.type === 'QR') {
			let {
				size: {
					x: width,
					y: height
				},
				margin
			} = field.qr;

			let value = field.value ?? field.defaultValue ?? 'empty';

			const imgToDraw = await qr.render(value, Math.max(width, height), margin);
			ctx.drawImage(imgToDraw, x, y, width, height);
		} else {
			let {
				fontSize,
				fontFamily,
				align,
				direction,
				selectable,
				stroke
			} = field.textFormat;
			if (typeof fontSize === 'number') fontSize += 'px';
			ctx.font = `${fontSize} ${fontFamily}`;
			
			if (align) {
				if (align === 'centre')
					align = 'center';
				ctx.textAlign = align;
			}

			ctx.direction = direction;

			if (selectable)
				ctx.textDrawingMode = 'glyph';
			else
				ctx.textDrawingMode = 'path';

			const { style } = field.textFormat;
			if (style != null) {
				switch (style.type) {
					case 'colour': {
						if (style.colour == null)
							style.colour = 'black';
						if (style.colour === 'invert') {
							ctx.globalCompositeOperation = 'difference';
							ctx.fillStyle = 'white';
						} else
							ctx.fillStyle = style.colour;
					}
					break;
					case 'gradient': {
						const {
							start: {
								x: x1,
								y: y1
							},
							end: {
								x: x2,
								y: y2
							},
							stops
						} = style.gradient;

						const grad = ctx.createLinearGradient(x1, y1, x2, y2);

						for (const stop of stops)
							grad.addColorStop(stop.fraction, stop.colour);

						ctx.fillStyle = grad;
					}
				}
			}

			let value;

			switch (field.type) {
				case 'Number':
				case 'String': {
					value = field.value ?? field.defaultValue ?? field.name;
				}
				break;
				case 'Boolean': {
					value = field.value ?? field.defaultValue ?? '?';
					
					if (value === true)
						value = '✓';
					else if (value === false)
						value = '✕';
				}
				break;
				case 'Date': {
					value = field.value ?? field.defaultValue ?? 'now';

					value = new Date(value);

					const format = field.dateFormat ?? '%d/%m/%Y';

					try {
						value = strftime(format, value);
					} catch(e) {
						console.error(`Failed to format date: ${e.message}`);
						console.error(e.stack);
						console.error(`Date: ${value}`);
						console.error(`Format: ${format}`);
						value = value.toISOString();
					}
				}
			}

			const {
				maxChars,
				maxWidth
			} = field.textFormat;

			if (maxChars != null)
				value = value.substr(0, maxChars);

			if (maxWidth == null)
				ctx.fillText(value, x, y);
			else
				ctx.fillText(value, x, y, maxWidth);

			if (stroke != null) {
				ctx.textDrawingMode = 'path';
				ctx.strokeStyle = stroke.colour;
				ctx.lineWidth = stroke.width;
				ctx.strokeText(value, x, y);
			}
		}
	}

	return can;
}

module.exports = {
	render
};