const { Schema, model } = require('mongoose');

const {
	fieldSchema,
	imageSchema,
	xySchema
} = require('./schemes');

const templateSchema = new Schema({
	name: {
		type: String,
		required: true,
		index: true,
		unique: true,
		primaryKey: true
	},
	title: {
		type: String,
		required: true
	},
	fields: [fieldSchema],
	background: {
		type: String,
		required: true
	},
	backgroundColour: {
		type: String,
		default: 'white'
	},
	dimensions: xySchema
}, {
	timestamps: {
		updatedAt: 'date',
		createdAt: false
	},
	id: false,
	versionKey: false
});

templateSchema.pre('save', function(next) {
	if (this.title == null)
		this.title = this.name;

	for (const field of this.fields) {
		/* if (
			typeof field.value !== 'number'
			&& typeof field.value !== 'string'
			&& typeof field.value !== 'boolean'
			&& typeof field.value != null
		)
			throw new Error(`Invalid value for field '${field.name}': Only string, numeric, and boolean values allowed.`); */
		
		if (['Number', 'Boolean', 'String', 'Image', 'Date'].indexOf(field.type) < 0)
			throw new Error(`Invalid type for field '${field.name}': Only Number, Boolean, String, Image, and Date allowed.`);
	}

	next();
});

// Keep the _id for Mongoose's internal use only
templateSchema.set('toJSON', {
	transform: function(doc, ret, options) {
		const propsToPrune = [
			'_id',
			'__v'
		];
		for (const prop of propsToPrune)
			if (ret[prop]) delete ret[prop];
		return ret;
	}
});

const Template = model('template', templateSchema);

module.exports = Template;