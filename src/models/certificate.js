const { v4: uuid } = require('uuid');
const { Schema, model } = require('mongoose');

const {
	valueSchema
} = require('./schemes');
const Template = require('./template');

const certificateSchema = new Schema({
	uid: {
		type: String,
		index: true,
		unique: true,
		primaryKey: true
	},
	title: {
		type: String,
		default: 'Certificate'
	},
	template: {
		type: String,
		required: true
	},
	values: [valueSchema]
}, {
	id: false,
	versionKey: false,
	timestamps: {
		createdAt: 'date',
		updatedAt: false
	}
});

// Verify template and add UID
certificateSchema.pre('save', async function(next) {
	const template = await Template.findOne({ name: this.template });
	if (template == null)
		throw new Error(`Template '${this.template}' not found!`);
	
	this.uid = uuid();
	next();
});

// Add extra property
certificateSchema.pre('find', function() {
	this.x = 1;
});

// Keep the _id for Mongoose's internal use only
certificateSchema.set('toJSON', {
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

const Certificate = model('certificate', certificateSchema);

module.exports = Certificate;