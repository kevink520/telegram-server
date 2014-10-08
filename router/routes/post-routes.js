var express = require('express');
var logger = require('nlogger').logger(module);
var mongoose = require('mongoose');
var ensureAuthenticated = require('../../authentication/ensure-authenticated');
var router = express.Router();
var Post = mongoose.model('Post');

function isFollowedByCurrentUser(user, currentUser) {
  if (!currentUser) {
    return false;
  }
  if (user.followedBy.indexOf(currentUser._id) != -1) {
    return true;
  } else {
    return false;
  }
}

function emberUser(user, currentUser) {
  var modifiedUser = {
    '_id': user._id,
    'username': user.username,
    'name': user.name,
    'password': '',
    'email': user.email,
    'photo': user.photo,
    'followedByCurrentUser': isFollowedByCurrentUser(user, currentUser)
  };
  return modifiedUser;
}

function filterUsersForEmber(users, currentUser) {
  var filteredUsers = (users || []).map(function(user) {
    return emberUser(user, currentUser);
  });
  
  return filteredUsers;
}

function sendPostsAndUsersResponse(res, postsArray, usersArray) {
  logger.info('The server successfully retrieved and sent the posts and ' +
              'the users.');
  res.send({
    'posts': postsArray,
    'users': usersArray
  });
}

function sendPostAndUsersResponse(res, postsArray, usersArray) {
  logger.info('The server successfully retrieved and sent the post and ' +
              'the users.');
  res.send({
    'post': postsArray[0],
    'users': usersArray
  });
}

function findUsersByIds(req, res, ids, postsArray, next) {
  var usersArray;
  var User = mongoose.model('User');
  if (!ids.length) {
    usersArray = [];
  } else if (ids.length === 1) {
    User.findById(ids[0], function(err, user) {
      if (err) {
        logger.error('An error occurred while finding the user. ' + err);
        res.status(500).end();
      } else {
        logger.info('The server successfully retrieved the user.');
        usersArray = filterUsersForEmber([user], req.user);
        
        next(res, postsArray, usersArray);
      }
    });
  } else {
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
        usersArray = filterUsersForEmber(users, req.user);
        next(res, postsArray, usersArray);
      }
    });
  } 
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
    if (!posts.length) {
      logger.error('The server found no posts owned by the current user and ' +
                   'the followees.');
      return res.status(404).send({
        'posts': []
      });
    }
    logger.info('The server successfully retrieved all posts owned by the ' +
                'current user and the followees.');
    var repostedFromIds = [];
    (posts || []).forEach(function(post) {
      if (post.repostedFrom) {
        repostedFromIds.push(post.repostedFrom);
      }
    });

    var combinedIds = currentUserAndFolloweesIds.concat(repostedFromIds);

    var uniqueCombinedIds = combinedIds.reduce(function(a, b) {
      if (a.indexOf(b) < 0) {
        a.push(b);
      }
      return a;
    }, []);
    
    findUsersByIds(req, res, uniqueCombinedIds, posts, sendPostsAndUsersResponse);

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
    if (!posts.length) {
      logger.info('The server found no posts owned by the profiled user.');
      return res.status(404).send({
        'posts': []
      });
    }

    var userIds = [req.query.ownedBy];

    (posts || []).forEach(function(post) {
      if (post.repostedFrom) {
        userIds.push(post.repostedFrom);
      }
    });

    var uniqueUserIds = userIds.reduce(function(a, b) {
      if (a.indexOf(b) < 0) {
        a.push(b);
      }
      return a;
    }, []);  

    findUsersByIds(req, res, uniqueUserIds, posts, sendPostsAndUsersResponse);

  });
}

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

      var userIds = [post.author];
      if (post.repostedFrom) {
        userIds.push(post.repostedFrom);
      }

      findUsersByIds(req, res, userIds, [post], sendPostAndUsersResponse);
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
