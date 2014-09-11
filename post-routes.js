var express = require('express');
var logger = require('nlogger').logger(module);
var mongoose = require('mongoose');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var db = require('./database');
var ensureAuthenticated = require('./ensure-authenticated');
var router = express.Router();

router.get('/', function(req, res) {
  logger.info('The server received a GET request for all posts.');
  db.on('error', console.error.bind(console, 'connection error:'));
  db.once('open', function callback() {
    var Post = mongoose.model('Post', postSchema);
    Post.find(function findCallback(err, posts) {
      if (err) {
        console.error(err);
      }
      logger.info('The server successfully retrieved and sent all posts.');
      return res.send({ posts: [posts] });
    });
  });
  res.status(404).end();
});

router.post('/', ensureAuthenticated, function(req, res) {
  if (req.user.id == req.body.post.author) {
    logger.info('The server received a POST request from authenticated author ' + req.body.post.author + ' to add a post.');
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function callback() {
      var Post = mongoose.model('Post', postSchema);
      var post = new Post({ 
        author: req.body.post.author,
        body: req.body.post.body,
        createdDate: req.body.post.createdDate
      });
      post.save(function saveCallback(err, post) {
        if (err) {
          return console.error(err);
        }
        logger.info('The server successfully added the post with the post ID ' + post.id + '.');
        return res.status(200).send({'post': post});
      });
    });
  }
  res.status(403).end();
});

router.delete('/:_id', function(req, res) {
  logger.info('The server received a DELETE request for a post with the following post ID: ' + req.params.id);
  db.on('error', console.error.bind(console, 'connection error:'));
  db.once('open', function callback() {
    var Post = mongoose.model('Post', postSchema);
    Post.remove({ _id: req.params._id }, function removeCallback(err, post) {
      if (err) {
        console.error(err);
      }
      logger.info('The server successfully deleted the post with the post ID ' + post.id + '.');
      return res.status(200).send({});
    });
  });
  res.status(404).end();
});

module.exports = router;
