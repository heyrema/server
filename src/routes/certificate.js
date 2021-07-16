const path = require('path');
const { Router } = require('express');
const multer = require('multer');

const controller = require('../controllers/certificate');

const router = Router();
const upload = multer({
	dest: path.join(process.env.TMP_DIR, 'uploads'),
	limits: {
		fileSize: 50 * 1024 * 1024 // 50 MB
	}
});

router.route('/')
.get(controller.getAll)
.post(controller.naveen)
.delete(controller.deleteMultiple);

router.route('/bulk')
.post(upload.single('list'), controller.bulk);

router.route('/:uid')
.get(controller.getSingle)
.patch(controller.patch)
.delete(controller.deleteSingle);

router.route('/:uid/view')
.get(controller.renderCertificate);

module.exports = router;