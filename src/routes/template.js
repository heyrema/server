const { Router } = require('express');
const templateController = require('../controllers/template');

const templateRouter = Router();

templateRouter.route('/')
.get(templateController.getAll)
.post(templateController.naveen)
.delete(templateController.deleteMultiple);

templateRouter.route('/:name')
.get(templateController.getSingle)
.patch(templateController.patch)
.delete(templateController.deleteSingle);

templateRouter.route('/:name/preview')
.get(templateController.preview);

templateRouter.route('/:name/extend')
.post(templateController.extend);

templateRouter.route('/:name/export')
.get(templateController.exportTemplate);

module.exports = templateRouter;