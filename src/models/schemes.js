const { Schema, model: { discriminator } } = require('mongoose');

const { Mixed } = Schema.Types;

const xySchema = new Schema({
	x: {
		type: Number,
		default: 0
	},
	y: {
		type: Number,
		default: 0
	}
}, {
	_id: false
});

const colourSchema = new Schema({
	value: {
		type: String,
		default: 'black' // Can be any valid CSS colour identifier (name, hexadecimal, RGB, RGBA, or HSL)
	}
}, {
	_id: false
});

const gradientSchema = new Schema({
	start: xySchema,
	end: xySchema,
	stops: [new Schema({
		fraction: {
			type: Number,
			required: true
		},
		colour: colourSchema
	}, { _id: false })]
}, {
	_id: false
});

const styleSchema = new Schema({
	/**
	 * Possible values:
	 * 1. colour (Default)
	 * 2. gradient
	 */
	type: {
		type: String,
		default: 'colour'
	},
	colour: {
		type: colourSchema,
		required: false,
		default: null
	},
	gradient: {
		type: gradientSchema,
		required: false,
		default: null
	}
}, {
	_id: false
});

const strokeSchema = new Schema({
	colour: {
		type: String,
		default: 'black'
	},
	width: {
		type: Number,
		default: 1
	}
}, {
	_id: false
});

const textFormatSchema = new Schema({
	fontFamily: {
		type: String,
		default: 'monospace'
	},
	fontSize: {
		type: Mixed,
		default: 10
	},
	stroke: {
		type: strokeSchema,
		required: false,
		default: null
	},
	style: styleSchema,
	/**
	 * Possible values:
	 * 1. left (Default)
	 * 2. centre
	 * 3. right
	 * 4. start
	 * 5. end
	 */
	align: {
		type: String,
		default: 'left',
	},
	selectable: {
		type: Boolean,
		default: true
	}
}, {
	_id: false
});

const fieldSchema = new Schema({
	name: {
		type: String,
		required: true
	},
	value: {
		type: Mixed,
		default: null
	},
	defaultValue: {
		type: Mixed,
		default: null
	},
	required: {
		type: Boolean,
		default: true
	},
	// Angle in degrees
	rotation: {
		type: Number,
		default: 0
	},
	/**
	 * Possible values:
	 * 1. Number
	 * 2. Boolean
	 * 3. String (Default)
	 * 4. Image
	 * 5. Date
	 */
	type: {
		type: String,
		default: 'String'
	},
	textFormat: {
		type: textFormatSchema,
		required: false,
		default: null
	},
	image: {
		type: new Schema({
			expectedSize: xySchema
		}, { _id: false }),
		required: false,
		default: null
	},
	dateFormat: {
		type: String,
		required: false,
		default: null
	},
	position: xySchema,
	fixed: {
		type: Boolean,
		default: false
	}
}, {
	_id: false
});

module.exports = {
	Mixed,
	xySchema,
	colourSchema,
	gradientSchema,
	patternSchema,
	styleSchema,
	textFormatSchema,
	fieldSchema
};