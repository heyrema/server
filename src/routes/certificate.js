const { Router } = require('express');
const controller = require('../controllers/certificate');

const router = Router();

router.route('/')
.get(controller.getAll)
.post(controller.naveen)
.delete(controller.deleteMultiple);

router.route('/:uid')
.get(controller.getSingle)
.patch(controller.patch)
.delete(controller.deleteSingle);

module.exports = router;