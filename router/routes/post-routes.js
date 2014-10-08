var express = require('express');
var logger = require('nlogger').logger(module);
var mongoose = require('mongoose');
var ensureAuthenticated = require('../../authentication/ensure-authenticated');
var router = express.Router();
var Post = mongoose.model('Post');

function findUsersByIds(req, res, ids) {
  var User = mongoose.model('User');
  User.find({
    _id: {
      $in: ids
    }
  }, function(err, users) {
    if (err) {
      logger.error('An error occurred while finding the users. ' + err);
      res.status(500).end();
    } else {
      logger.info('The server successfully retrieved the users.');
      return users;
    }
  });
}

function handleQueryDashboardsPostsRequest(req, res) {
  if (!req.user) {
    logger.error('The server found no logged-in user.');
    return res.status(404).end();
  }
  var currentUserAndFolloweesIds = req.user.follows.concat(req.user._id);

  var posts = Post.find({
    author: {
      $in: currentUserAndFolloweesIds
    }
  }, function(err, posts) {
    if (err) {
      logger.error('An error occurred while finding all posts owned by the ' + 
                   'current user and the followees. ' + err);
      return res.status(500).end();
    }
    if (!posts) {
      logger.error('The server found no posts owned by the current user and ' +
                   'the followees.');
      return res.status(404).end();
    }
    logger.info('The server successfully retrieved all posts owned by the ' +
                'current user and the followees.');
    
    var users = findUsersByIds(req, res, currentUserAndFolloweesIds);

    res.send({
      posts: posts,
      users: users
    });
  });    
}

function handleQueryProfilePostsRequest(req, res) {
  logger.info('The server received a GET request for all posts owned by the ' +
              'profiled user.');
  logger.info('Retrieving posts for ' + req.query.ownedBy);
  Post.find({
    author: req.query.ownedBy
  }, function(err, posts) {
    if (err) {
      logger.error('An error occurred while finding all posts owned by the ' +
                   'profiled user.');
      return res.status(500).end();
    }
    if (!posts) {
      logger.info('The server found no posts owned by the profiled user.');
      return res.send({
        posts: []
      });
    }
    logger.info('The server successfully retrieved and sent all posts owned ' +
                'by the profiled user.');
    return res.send({
      posts: posts
    });
  });
}

/*function handleRequestForAllUsers(req, res) {
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
}*/

router.get('/', function(req, res) {
  if (req.query.ownedBy) {
    handleQueryProfilePostsRequest(req, res);
  } else if (req.user && req.query.ownedByCurrentUserAndFollowees) {
    handleQueryDashboardsPostsRequest(req, res);
  } else {
    logger.error('The server received a GET request without proper query ' + 
                 'values. The server returned a 404 status code.');
    res.status(404).end();
  }
});

router.post('/', ensureAuthenticated, function(req, res) {
  if (req.user._id == req.body.post.author 
    || req.user._id == req.body.post.repostedBy) {
    logger.info('The server received a POST request from authenticated ' +
                'author or reposter to add a post.');
    var post = new Post({ 
      author: req.body.post.author,
      repostedFrom: req.body.post.repostedFrom,
      body: req.body.post.body,
      createdDate: req.body.post.createdDate
    });
    post.save(function(err, post) {
      if (err) {
        logger.error('An error occurred while saving the post to the ' +
                     'database. ' + err);
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
  logger.info('The server received a DELETE request for a post with the ' + 
              'following post ID: ' + req.params._id);
  Post.findOneAndRemove({
    _id: req.params._id
  }, function(err, post) {
    if (err) {
      logger.error('An error occurred while removing the post with the ' + 
                   'post ID: ' + req.params._id + ' from the database. ' + err);
      return res.status(500).end();
    }
    logger.info('The server successfully deleted the post with the post ID ' + 
                req.params._id + '.');
    return res.status(200).send({});
  });
});

module.exports = router;
