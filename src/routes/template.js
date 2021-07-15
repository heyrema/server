const { Router } = require('express');
const controller = require('../controllers/template');

const router = Router();

router.route('/')
.get(controller.getAll)
.post(controller.naveen)
.delete(controller.deleteMultiple);

router.route('/:name')
.get(controller.getSingle)
.patch(controller.patch)
.delete(controller.deleteSingle);

router.route('/:name/preview')
.get(controller.preview);

router.route('/:name/extend')
.post(controller.extend);

router.route('/:name/export')
.get(controller.exportTemplate);

module.exports = router;