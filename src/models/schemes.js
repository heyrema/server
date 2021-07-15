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

const gradientSchema = new Schema({
	start: xySchema,
	end: xySchema,
	stops: [new Schema({
		fraction: {
			type: Number,
			required: true
		},
		colour: {
			type: String,
			required: false,
			default: null // Can be any valid CSS colour identifier (name, hexadecimal, RGB, RGBA, or HSL)
		}
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
		type: String,
		required: false,
		default: null // Can be any valid CSS colour identifier (name, hexadecimal, RGB, RGBA, or HSL)
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
	maxWidth: {
		type: Number,
		default: null
	},
	maxChars: {
		type: Number,
		default: null
	},
	stroke: {
		type: strokeSchema,
		required: false,
		default: null
	},
	style: styleSchema,
	/**
	 * Possible values:
	 * 1. left
	 * 2. centre
	 * 3. right
	 * 4. start (Default)
	 * 5. end
	 */
	align: {
		type: String,
		default: 'start',
	},
	/**
	 * Possible values:
	 * 1. ltr (Default)
	 * 2. rtl
	 */
	direction: {
		type: String,
		default: 'ltr'
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
	placeholder: {
		type: Boolean,
		default: false
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
			size: xySchema
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
	gradientSchema,
	styleSchema,
	textFormatSchema,
	fieldSchema
};