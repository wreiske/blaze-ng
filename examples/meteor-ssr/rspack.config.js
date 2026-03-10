const { defineConfig } = require('@meteorjs/rspack');

/**
 * Rspack configuration for Meteor projects.
 *
 * Provides typed flags on the `Meteor` object, such as:
 * - `Meteor.isClient` / `Meteor.isServer`
 * - `Meteor.isDevelopment` / `Meteor.isProduction`
 * - …and other flags available
 *
 * Use these flags to adjust your build settings based on environment.
 */
module.exports = defineConfig((Meteor) => {
  const config = {};

  // On the server, .html template files are compiled and loaded by Meteor's
  // build system (templating-compiler via server-meteor.js). Tell rspack to
  // replace .html imports with empty modules so it doesn't try to parse
  // raw HTML as JavaScript.
  if (Meteor.isServer) {
    config.module = {
      rules: [
        {
          test: /\.html$/,
          type: 'asset/source',
          generator: {
            emit: false,
          },
        },
      ],
    };
  }

  return config;
});
