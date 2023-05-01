const qr = require('qrcode');
const { loadImage } = require('canvas');

const render = async (data, width, margin = 1) => {
	const code = await qr.toDataURL(data, {
		width,
		margin
	});

	return await loadImage(code);
};

module.exports = {
	render
};