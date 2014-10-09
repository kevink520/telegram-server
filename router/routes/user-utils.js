var logger = require('nlogger').logger(module);
var db = require('../../database/database');
var User = db.model('User');
var bcrypt = require('bcrypt');

var UserUtils = exports;

UserUtils.isFollowedByUser = function(user, follower) {
  if (!follower) {
    return false;
  }
  if (user.followedBy.indexOf(follower._id) != -1) {
    return true;
  } else {
    return false;
  }
}

UserUtils.emberUser = function(user, currentUser) {
  var filteredUserForEmber = {
    '_id': user._id,
    'username': user.username,
    'name': user.name,
    'password': '',
    'email': user.email,
    'photo': user.photo,
    'followedByCurrentUser': UserUtils.isFollowedByUser(user, currentUser)
  };
  return filteredUserForEmber;
}

UserUtils.emberUsers = function(users, currentUser) {
  var filteredUsersForEmber = (users || []).map(function(user) {
    return UserUtils.emberUser(user, currentUser);
  });
  
  return filteredUsersForEmber;
}

UserUtils.encryptPassword = function(req, res, password, user, newPassword,
                                     afterEncryption) {
  bcrypt.genSalt(10, function(err, salt) {
    if (err) {
      logger.error('An error occurred while generating a salt using bcrypt. ' + 
                   err);
      return afterEncryption(err);
    }
    bcrypt.hash(password, salt, function(err, hash) {
      if (err) {
        logger.error('An error occurred while hashing the password using ' + 
                     'bcrypt. ' + err);
        return afterEncryption(err);
      }
      afterEncryption(null, req, res, hash, user, newPassword);
    });
    
  });
}

UserUtils.addUserAsFollowee = function(followerId, followeeId, callback) {
  User.findByIdAndUpdate(followerId, {
    $addToSet: {
      follows: followeeId
    }
  }, function(err, numAffected) {
    if (err) {
      logger.error('An error occurred while updating the user\'s ' + 
                   'follows field. ' + err);
      return callback(err);
    }
    if (numAffected) {
      logger.info('The server successfully added the user\'s _id to ' +
                  'the other user\'s follows field.');
    } else {
      logger.error('No user\'s follows field was updated in the database.');
    }
    callback(null);
  });
}

UserUtils.addUserAsFollower = function(followerId, followeeId, callback) {
  User.findByIdAndUpdate(followeeId, {
    $addToSet: {
      followedBy: followerId
    }
  }, function(err, numAffected) {
    if (err) {
      logger.error('An error occurred while updating the user\'s ' +
                   'followedBy field. ' + err);
      callback(err);
    }
    if (numAffected) {
      logger.info('The server successfully added the user\'s _id to ' +
                  'the other user\'s followedBy field.');
    } else {
      logger.error('No user\'s followedBy field was updated in the database.');
    }
    callback(null);
  });
}

UserUtils.removeUserFromFollowees = function(followerId, followeeId, callback) {
  User.findByIdAndUpdate(followerId, {
    $pull: {
      follows: followeeId
    }
  }, {
    multi: true
  }, function(err, numAffected) {
    if (err) {
      logger.error('An error occurred while removing the user\'s _id ' + 
                   'from the other user\'s follows field. ' + err);
      callback(err);
    }
    if (numAffected) {
      logger.info('The server successfully removed the user\'s _id ' +
                  'from the other user\'s follows field.');
    } else {
      logger.error('No user\'s record was updated in the database.');
    }
    callback(null);
  });
}

UserUtils.removeUserFromFollowers = function(followerId, followeeId, callback) {
  User.findByIdAndUpdate(followeeId, {
    $pull: {
      followedBy: followerId
    }
  }, {
    multi: true
  }, function(err, numAffected) {
    if (err) {
      logger.error('An error occurred while updating the user\'s ' +
                   'followedBy field. ' + err);
      callback(err);
    }
    if (numAffected) {
      logger.info('The server successfully removed the user from the ' +
                  'other user\'s followedBy field.');
    } else {
      logger.error('No user\'s record was updated in the database.');
    }
    callback(null);
  });
}
