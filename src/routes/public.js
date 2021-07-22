const path = require('path');
const { Router, static } = require('express');

const controller = require('../controllers/public');
const certController = require('../controllers/certificate');

const router = Router();

router.route('/')
.get(controller.index);

if (process.env.DIRECTORY)
	router.route('/directory')
	.get(controller.directory);

router.route('/certificate/:uid')
.get(controller.certificate);

router.route('/certificate/:uid/certificate.png')
.get((req, res, next) => {
	if (req.query.pdf != null)
		delete req.query.pdf;
	next();
}, certController.renderCertificate);

router.route('/certificate/:uid/certificate.pdf')
.get((req, res, next) => {
	if (req.query.pdf == null)
		req.query.pdf = '';
	next();
}, certController.renderCertificate);

router.use(`/modules`, static(path.join(__dirname, '..', 'node_modules')));

module.exports = router;