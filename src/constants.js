const path = require('path');

const STATIC_DIR = path.resolve(__dirname, 'static');
const INTERNAL_STATIC_DIR = path.resolve(STATIC_DIR, 'internal');

// Reducing to consume less memory, exceeding it will cause the rendered output to be scaled down
const MAX_CAIRO_DIMENSION = (
	(process.env.MAX_DIMENSION_OVERRIDE <= 32767 ? process.env.MAX_DIMENSION_OVERRIDE : null)
	?? 9830
);

const SINGLE_WHITE_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

module.exports = {
	STATIC_DIR,
	INTERNAL_STATIC_DIR,
	MAX_CAIRO_DIMENSION,
	SINGLE_WHITE_PIXEL
};