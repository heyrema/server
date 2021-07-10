const { Router } = require('express');
const templateController = require('../controllers/template');

const templateRouter = Router();

templateRouter.route('/')
.post(templateController.naveen);

templateRouter.route('/:name')
.get(templateController.getSingle);

templateRouter.route('/:name/preview')
.get(templateController.preview);

module.exports = templateRouter;