const PLACEHOLDERS = {
	TEMPLATE_TITLE: {
		get: v => v.templateTitle,
		check: o => o.value != null && o.type === 'String'
	},
	TEMPLATE_DATE: {
		get: v => v.templateDate,
		check: o => o.value != null && o.type === 'Date'
	},
	CERTIFICATE_TITLE: {
		get: v => v.title,
		check: o => o.value != null && o.type === 'String'
	},
	CERTIFICATE_DATE: {
		get: v => v.date,
		check: o => o.value != null && o.type === 'Date'
	},
	CERTIFICATE_UID: {
		get: v => v.uid,
		check: o => o.value != null && o.type === 'String'
	}
};

const isValidPlaceholder = o => o.placeholder && o?.value in PLACEHOLDERS && PLACEHOLDERS[o.value].check(o);

const getPlaceholder = o => isValidPlaceholder(o) && PLACEHOLDERS[o.value].get;

module.exports = {
	isValidPlaceholder,
	getPlaceholder
};