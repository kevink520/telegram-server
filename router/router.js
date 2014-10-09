module.exports = function(app) {
  app.use('/api/users', require('./routes/user-routes'));
  app.use('/api/posts', require('./routes/post-routes'));
};
