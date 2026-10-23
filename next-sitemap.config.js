const config = {
  sourceDir: process.env.NEXT_BUILD_DIR || '.next',
  siteUrl: "https://www.aaronjcunningham.com",
  generateRobotsTxt: true,
  generateIndexSitemap: false,
  exclude: ["/globe", "/mauve-zone", "/music-visualizer", "/community/shop/checkout", "/community/shop/success", "/community/shop/demo", "/community/shop/payment", "/community/shop/confirmation"],
};

module.exports = config;
