const path = require('path');

const INTERNAL_STATIC_DIR = process.env.INTERNAL_STATIC_DIR ?? path.resolve(__dirname, '..', 'static') + path.sep;

// Reducing to consume less memory, exceeding it will cause the rendered output to be scaled down
const MAX_CAIRO_DIMENSION = (
	(process.env.MAX_DIMENSION_OVERRIDE <= 32767 ? process.env.MAX_DIMENSION_OVERRIDE : null)
	?? 9830
);

const SINGLE_WHITE_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

const PORT = process.env.PORT ?? 8080;
const DB = process.env.DB ?? `mongodb://localhost/rema`;
const BASE_ROUTE = process.env.BASE_ROUTE ?
	(
		process.env.BASE_ROUTE.endsWith('/') ? process.env.BASE_ROUTE : process.env.BASE_ROUTE + '/'
	)
	: '/';

const STOCK_DATA_URL = `https://github.com/paramsiddharth/rema/releases/download/stock-data-v2.0/static.zip`;

module.exports = {
	INTERNAL_STATIC_DIR,
	MAX_CAIRO_DIMENSION,
	SINGLE_WHITE_PIXEL,
	PORT,
	DB,
	BASE_ROUTE,
	STOCK_DATA_URL
};