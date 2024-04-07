Package.describe({
  name: 'liristech:create-config',
  version: '0.0.2',
  summary: 'Data-driven configuration for your app logic overridable from Meteor Collections',
  git: 'https://github.com/liris-tech/create-config.git',
  documentation: 'README.md'
});

Npm.depends({
  lodash: '4.17.21'
});

Package.onUse(function(api) {
  api.versionsFrom('2.15');
  api.use('ecmascript');
  api.mainModule('common.js');
});