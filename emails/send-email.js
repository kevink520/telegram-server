var fs = require('fs');
var logger = require('nlogger').logger(module);
var Handlebars = require('handlebars');
var UserUtils = require('../router/routes/user-utils');
var config = require('../config/config');
var mailgun = require('mailgun-js')({ 
  apiKey: config.MAILGUN_API_KEY, 
  domain: config.MAILGUN_DOMAIN
});

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

function returnUserToClient(user, currentUser) {

  var modifiedUser = {
    '_id': user._id,
    'username': user.username,
    'name': user.name,
    'password': '',
    'email': user.email,
    'photo': user.photo,
    'followedByCurrentUser': UserUtils.isFollowedByUser(user, currentUser)
  };
  return modifiedUser;
}

module.exports = function sendEmail(newPassword, user, res) {
  fs.readFile(__dirname + '/password-email-template.hbs', function(err, data) {
    if (err) {
      logger.error('An error occurred while reading the email template. ' + err);
      return res.status(500).end();
    }
    var source = data.toString();
    var template = Handlebars.compile(source);
    var passwordData = { 
      password: newPassword 
    };
    var html = template(passwordData);
    var emailData = {
      from: 'The Telegram App Team <kevinkim75@gmail.com>',
      to: user.email,
      subject: 'Your New Password for the Telegram App',
      html: html
    };

    mailgun.messages().send(emailData, function(err, body) {
      if (err) {
        logger.error('An error occurred while sending the email containing ' +
                     'the new password to the user. ' + err);
        return res.status(500).end();
      }
      logger.info('Successfully sent email. ' + body);
      return res.send({ 
        'users': [UserUtils.emberUser(user, null)] 
      });
    });
  });               
}
