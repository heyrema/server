const { Schema } = require('mongoose');

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
});

const imageSchema = new Schema({
	src: {
		type: String,
		required: true
	},
	dimensions: xySchema
});

const colourSchema = new Schema({
	type: String,
	default: 'black' // Can be any valid CSS colour identifier (name, hexadecimal, RGB, RGBA, or HSL)
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
	})]
});

const patternSchema = new Schema({
	image: imageSchema,
	repetition: {
		type: String,
		default: 'repeat'
		/**
		 * Possible values:
		 * 1. repeat
		 * 2. repeat-x
		 * 3. repeat-y
		 * 4. no-repeat
		 */
	}
});

const styleSchema = new Schema({
	type: {
		type: String,
		default: 'colour'
		/**
		 * Possible values:
		 * 1. colour
		 * 2. gradient
		 * 3. pattern
		 */
	},
	colour: colourSchema,
	gradient: gradientSchema,
	pattern: patternSchema
});

const textFormatSchema = new Schema({
	position: xySchema,
	fontFamily: {
		type: String,
		required: true
	},
	fontSize: {
		type: Mixed,
		required: true
	},
	style: styleSchema
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
	type: {
		type: String,
		default: 'String'
		/**
		 * Possible values:
		 * 1. Number
		 * 2. Boolean
		 * 3. String
		 * 4. Image
		 * 5. Date
		 */
	},
	textFormat: {
		type: textFormatSchema,
		required: false,
		default: null
	},
	image: {
		type: imageSchema,
		required: false,
		default: null
	},
	fixed: {
		type: Boolean,
		default: false
	}
});

module.exports = {
	Mixed,
	xySchema,
	imageSchema,
	colourSchema,
	gradientSchema,
	patternSchema,
	styleSchema,
	textFormatSchema,
	fieldSchema
};