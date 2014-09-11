module.exports = function(app) {
  app.use('/api/users', require('./user-routes'));
  app.use('/api/posts', require('./post-routes'));
  app.use('/api/logout', require('./logout-route'));
};
