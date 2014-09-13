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
  var Post = mongoose.model('Post');
  Post.find(function findCallback(err, posts) {
    if (err) {
      console.error(err);
      return res.status(500).end();
    }
    var postsArray = [];
    (posts || []).forEach(function(post) {
      postsArray.push(post);
    });
    logger.info('The server successfully retrieved and sent all posts.');
    return res.send({ posts: postsArray });
  });
});

router.post('/', ensureAuthenticated, function(req, res) {
  if (req.user._id == req.body.post.author) {
    logger.info('The server received a POST request from authenticated author ' + req.body.post.author + ' to add a post.');
    var Post = mongoose.model('Post');
    var post = new Post({ 
      author: req.body.post.author,
      body: req.body.post.body,
      createdDate: req.body.post.createdDate
    });
    post.save(function saveCallback(err, post) {
      if (err) {
        console.error(err);
        return res.status(500).end();
      }
      logger.info('The server successfully added the post.');
      return res.status(200).send({'post': post});
    });
  } else {
    logger.error('The user is not authorized to post.');
    return res.status(403).end();
  }
});

router.delete('/:_id', function(req, res) {
  logger.info('The server received a DELETE request for a post with the following post ID: ' + req.params._id);
  var Post = mongoose.model('Post');
  Post.remove({ _id: req.params._id }, function removeCallback(err, post) {
    if (err) {
      console.error(err);
      return res.status(500).end();
    }
    logger.info('The server successfully deleted the post with the post ID ' + req.params._id + '.');
    return res.status(200).send({});
  });
});

module.exports = router;
