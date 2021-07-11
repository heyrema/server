const { Router } = require('express');
const templateController = require('../controllers/template');

const templateRouter = Router();

templateRouter.route('/')
.get(templateController.getAll)
.post(templateController.naveen)
.delete(templateController.deleteMultiple);

templateRouter.route('/:name')
.get(templateController.getSingle)
.delete(templateController.deleteSingle);

templateRouter.route('/:name/preview')
.get(templateController.preview);

templateRouter.route('/:name/extend')
.post(templateController.extend);

module.exports = templateRouter;