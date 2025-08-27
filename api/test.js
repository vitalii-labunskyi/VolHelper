module.exports = (req, res) => {
  res.json({
    status: 'OK',
    message: 'Simple test API works!',
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method
  });
};