var express = require('express');
var logger = require('nlogger').logger(module);
var mongoose = require('mongoose');
var ensureAuthenticated = require('../../authentication/ensure-authenticated');
var router = express.Router();

function handleQueryByOwnedByFolloweesOf(req, res) {
  logger.info('The server received a GET request for all posts owned by followees of the current user with _id ' + req.query.ownedByFolloweesOf);
  var User = mongoose.model('User');
  User.findById(req.query.ownedByFolloweesOf, 'follows', function(err, user) {
    if (err) {
      logger.error('An error occurred while retrieving the follows array containing _ids of the current user\'s followees.' + err);
      return res.status(500).end();
    }
    if (!user) {
      logger.error('No user was found with the provided current user _id.');
      return res.status(404).end();
    }
    logger.info('The server found the user object.');
    var orQueryArray = user.follows.map(function(followeeId) {
      return {
        author: followeeId
      };
    });
    logger.info('The server generated the or query array.');
    if (!orQueryArray.length) {
      logger.info('The server found no followees of the current user.');
      return res.send({
        posts: []
      });
    }
    var Post = mongoose.model('Post');
    var posts = Post.find({ 
      $or: orQueryArray
    }, function(err, posts) {
      if (err) {
        logger.error('An error occurred while finding all posts owned by followees of the current user. ' + err);
      }
      if (!posts) {
        logger.error('The server found no posts owned by followees of the current user.');
        return res.status(404).end();
      }
      logger.info('The server successfully retrieved and sent all posts owned by followees of the current user.');
      res.send({
        posts: posts
      });
    });    
  });
}

function handleQueryByOwnedBy(req, res) {
  logger.info('The server received a GET request for all posts owned by the profiled user.');
  var Post = mongoose.model('Post');
  Post.find({
    author: req.query.ownedBy
  }, function(err, posts) {
    if (err) {
      logger.error('An error occurred while finding all posts owned by the profiled user.');
      return res.status(500).end();
    }
    if (!posts) {
      logger.info('The server found no posts owned by the profiled user.');
      return res.send({
        posts: []
      });
    }
    logger.info('The server successfully retrieved and sent all posts owned by the profiled user.');
    return res.send({
      posts: posts
    });
  });
}

function handleRequestForAllUsers(req, res) {
  logger.info('The server received a GET request for all posts.');
  var Post = mongoose.model('Post');
  Post.find(function(err, posts) {
    if (err) {
      logger.error('An error occurred while retrieving all posts from the database. ' + err);
      return res.status(500).end();
    }
    var postsArray = [];
    (posts || []).forEach(function(post) {
      postsArray.push(post);
    });
    logger.info('The server successfully retrieved and sent all posts.');
    return res.send({ posts: postsArray });
  });
}

router.get('/', function(req, res) {
  if (req.query.ownedByFolloweesOf) {
    handleQueryByOwnedByFolloweesOf(req, res);
  } else if (req.query.ownedBy) {
    handleQueryByOwnedBy(req, res);
  } else {
    handleRequestForAllUsers(req, res);
  }
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
    post.save(function(err, post) {
      if (err) {
        logger.error('An error occurred while saving the post to the database. ' + err);
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
  Post.remove({
    _id: req.params._id
  }, function(err, post) {
    if (err) {
      logger.error('An error occurred while removing the post with the post ID: ' + req.params._id + ' from the database. ' + err);
      return res.status(500).end();
    }
    logger.info('The server successfully deleted the post with the post ID ' + req.params._id + '.');
    return res.status(200).send({});
  });
});

module.exports = router;
