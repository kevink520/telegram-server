var express = require('express');
var logger = require('nlogger').logger(module);
var router = express.Router();

router.get('/', function(req, res) {
  req.logout();
  res.status(200).send('Success');
  logger.info('Successfully logged out user.')
});

module.exports = router;