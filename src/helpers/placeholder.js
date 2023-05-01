const PLACEHOLDERS = {
	TEMPLATE_TITLE: {
		get: v => v.templateTitle,
		check: o => o.value != null && ['String', 'QR'].indexOf(o.type) >= 0
	},
	TEMPLATE_DATE: {
		get: v => v.templateDate,
		check: o => o.value != null && o.type === 'Date'
	},
	CERTIFICATE_TITLE: {
		get: v => v.title,
		check: o => o.value != null && ['String', 'QR'].indexOf(o.type) >= 0
	},
	CERTIFICATE_DATE: {
		get: v => v.date,
		check: o => o.value != null && o.type === 'Date'
	},
	CERTIFICATE_UID: {
		get: v => v.uid,
		check: o => o.value != null && ['String', 'QR'].indexOf(o.type) >= 0
	}
};

const isValidPlaceholder = o => {
	if (!o.placeholder)
		return false;

	for (const placeholderType in PLACEHOLDERS) {
		if ((
			o?.value?.includes(placeholderType) && (['String', 'QR'].indexOf(o.type) >= 0)
			|| o?.value === placeholderType
		) && PLACEHOLDERS[placeholderType].check(o))
			return true;
	}

	return false;
};

const getPlaceholder = o => {
	if (isValidPlaceholder(o))
		return cert => {
			let resultString = o.value;

			if (['String', 'QR'].indexOf(o.type) >= 0) {
				for (const placeholderType in PLACEHOLDERS) {
					if (o?.value?.includes(placeholderType) && PLACEHOLDERS[placeholderType].check(o)) {
						const placeholderValue = PLACEHOLDERS[placeholderType].get(cert);
						resultString = resultString.replace(new RegExp(placeholderType, 'g'), placeholderValue);
					}
				}
			} else {
				resultString = PLACEHOLDERS[o.value].get(cert);
			}
			return resultString;
		};
};

module.exports = {
	isValidPlaceholder,
	getPlaceholder
};