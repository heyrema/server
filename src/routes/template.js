const { Router } = require('express');
const templateController = require('../controllers/template');

const templateRouter = Router();

templateRouter.route('/')
.get(templateController.getAll)
.post(templateController.naveen);

templateRouter.route('/:name')
.get(templateController.getSingle)
.delete(templateController.deleteSingle);

templateRouter.route('/:name/preview')
.get(templateController.preview);

module.exports = templateRouter;