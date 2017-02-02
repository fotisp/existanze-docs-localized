var _ = require('lodash');
var async = require('async');


module.exports = {
  improve: 'apostrophe-docs',
  afterConstruct:function(self){


    self.apos.app.use(self.localizedHelper);
    self.apos.app.use(self.localizedSessionToLocale);
    self.apos.app.use(self.localizedGet);


  },
  construct:function(self,options){


    self.defaultLocale = options.default || "en";

    self.localizedHelper=function(req, res, next) {
      self.addHelpers({

        localePicker:function(args){


          var locales = [];
          var availableLanguages = _.keys(locales);

          var urls = require('url');
          var parsed = urls.parse(req.url, true);
          delete parsed.search;
          delete parsed.query.apos_refresh;
          var currentUrl = urls.format(parsed);



          if (args && args.localized && args._edit == undefined) {
            availableLanguages = _.keys(args.localized);
          }

          _.each(options.locales, function (label, locale) {
            var newUrl = '/' + locale + currentUrl;

            var localeObject = {
              key: locale,
              label: label,
              url: newUrl,
              translated: (_.indexOf(availableLanguages, locale) >=0) ,
              active: (req.locale === locale)
            };

            locales.push(localeObject);

          });

          return self.partial('localePicker', {locales: locales, args: args});

        }
      });

      return next();

    };

    self.localizedSessionToLocale=function(req, res, next) {

      if(req.session.locale){
        req.locale = req.session.locale;
      }else{
        req.locale = options.default;
      }


      console.log("Running Locale Middleware ",req.locale);

      return next();

    };

    self.localizedGet=function(req, res, next) {
      if (req.method !== 'GET') {
        return next();
      }

      var matches = req.url.match(/^\/(\w+)(\/.*|\?.*|)$/);
      if (!matches) {
        return next();
      }

      if (!_.has(options.locales, matches[1])) {
        return next();
      }

      req.locale = matches[1];
      req.session.locale = req.locale;
      req.url = matches[2];

      if (!req.url.length) {
        req.url = "/"
      }

      return next();

    };



    self.localized = [ 'title' ].concat(options.localized || []);

    self.docBeforeSave = function(req, doc, options) {


      //TODO check why req.locale is always en
      // using req.session.locale as a fallback
      var locale = req.session ? req.session.locale : req.locale;

      ensureProperties(doc,locale);

      var before = JSON.stringify(doc.localized[locale] || {});

      _.each(doc, function(value, key) {
        if (!isArea(value)) {
          return;
        }
        if (isUniversal(doc, key)) {
          return;
        }

        doc.localized[locale][key] = value;
        // Revert .body to the default culture's body, unless
        // that doesn't exist yet, in which case we let it spawn from
        // the current culture
        if (_.has(doc.localized[self.defaultLocale], key)) {
          doc[key] = doc.localized[self.defaultLocale][key];
        } else {

          doc.localized[self.defaultLocale][key] = doc[key];

        }
      });

      _.each(self.localized, function(name) {
        name = localizeForPage(doc, name);
        if (!name) {
          return;
        }
        doc.localized[locale][name] = doc[name];
        // Revert .title to the default culture's title, unless
        // that doesn't exist yet, in which case we let it spawn from
        // the current culture
        if (_.has(doc.localized[self.defaultLocale], name)) {
          doc[name] = doc.localized[self.defaultLocale][name];
        } else {
          doc.localized[self.defaultLocale][name] = doc[name];
        }
      });


      var after = JSON.stringify(doc.localized[locale] || {});

      if (before !== after) {
        doc.localizedAt[locale] = new Date();
        if (locale === self.default) {
          doc.localizedStale = _.without(_.keys(options.locales), self.defaultLocale);
        } else {
          // modifies in place
          _.pull(doc.localizedStale, locale);
        }
      }

      // console.log(JSON.stringify(doc));

    };
    //
    // self.docsAfterLoad=function(req,docs){
    //
    //
    //   if (!docs) {
    //     console.log("There are no docs returning");
    //     return
    //   }
    //   //TODO check why req.locale is always en
    //   // using req.session.locale as a fallback
    //   var locale = req.session.locale;
    //
    //
    //   _.each(docs, function(doc) {
    //
    //     if (_.contains(self.neverTypes, doc.type)) {
    //       return;
    //     }
    //
    //     ensureProperties(doc, req);
    //
    //     // We translate top-level properties specifically called out for translation,
    //     // plus all top-level areas not specifically denied translation. A recursive
    //     // walk of all areas is a bad idea here because it would make more sense
    //     // to just translate the entire top-level area. -Tom
    //
    //     _.each(doc, function(value, key) {
    //       if (!isArea(value)) {
    //         return;
    //       }
    //       if (isUniversal(doc, key)) {
    //         return;
    //       }
    //
    //       // for bc with sites that didn't have this module until
    //       // this moment, if the default locale has no content,
    //       // populate it from the live property
    //       if (!_.has(doc.localized[self.defaultLocale], key)) {
    //         doc.localized[self.defaultLocale] = doc[key];
    //       }
    //
    //       if (!_.has(doc.localized[locale], key)) {
    //         return;
    //       }
    //
    //       // do a shallow clone so the slug property can differ
    //       doc[key] = _.clone(doc.localized[locale][key]);
    //
    //     });
    //
    //     // Other properties are localized only if they are on the list.
    //
    //     _.each(self.localized, function(name) {
    //       name = localizeForPage(doc, name);
    //       if (!name) {
    //         return;
    //       }
    //
    //       // for bc with sites that didn't have this module until
    //       // this moment, if the default locale has no content,
    //       // populate it from the live property
    //       if (!_.has(doc.localized[self.defaultLocale], name)) {
    //         doc.localized[self.defaultLocale] = doc[name];
    //       }
    //
    //       if (!_.has(doc.localized[locale], name)) {
    //         return;
    //       }
    //       doc[name] = doc.localized[locale][name];
    //     });
    //
    //   });
    //
    // };

    function localizeForPage(page, name) {
      var matches = name.match(/[\w+]:[\w+]/);
      if (matches) {
        if (page.type !== matches[1]) {
          return;
        }
        name = matches[2];
      }
      if (!_.has(page, name)) {
        return;
      }
      return name;
    }

    function isArea(value) {
      if ((!value) || (value.type !== 'area')) {
        return false;
      }
      return true;
    }

    function isUniversal(page, key) {
      if (_.has(self.options.universal || [], key) || _.has(self.options.universal || [], page.type + ':' + key)) {
        return;
      }
    }

    function ensureProperties(page, locale) {
      if (!_.has(page, 'localized')) {
        page.localized = {};
      }
      if (!_.has(page, 'localizedAt')) {
        page.localizedAt = {};
      }
      if (!_.has(page, 'localizedStale')) {
        page.localizedStale = [];
      }
      page.localizedSeen = _.union(page.localizedSeen || [], _.keys(self.locales));
      if (!_.has(page.localized, locale)) {
        page.localized[locale] = {};
      }
      if (!_.has(page.localized, self.defaultLocale)) {
        page.localized[self.defaultLocale] = {};
      }
    }


    // merge new methods with all apostrophe-cursors
    self.apos.define('apostrophe-cursor', require('./lib/cursor.js'));
  }


}