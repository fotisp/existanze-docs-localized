
var _ = require('lodash');
var async = require('async');
var util = require('util');

module.exports = {
  construct: function(self, options) {

    self.addFilter('localize', {


      after:function(results,callback){
        var req = self.get('req');

        var defaultLocale = "en";
        var locale = req.session ?
          req.session.locale : req.locale  ;

        locale =  locale ? locale : defaultLocale;

        console.log("**********\n");
        console.log("Working as Locale ",locale);
        console.log("\n**********");

        function ensureProperties(page) {
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
          if (!_.has(page.localized, defaultLocale)) {
            page.localized[defaultLocale] = {};
          }
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



        _.each(results,function(doc){


          ensureProperties(doc);
          console.log("Working with ",JSON.stringify(doc.title));
          _.each(doc, function(value, key) {
            if (!isArea(value)) {
              return;
            }
            if (isUniversal(doc, key)) {
              return;
            }

            // for bc with sites that didn't have this module until
            // this moment, if the default locale has no content,
            // populate it from the live property
            if (!_.has(doc.localized[defaultLocale], key)) {
              doc.localized[defaultLocale] = doc[key];
            }

            if (!_.has(doc.localized[locale], key)) {
              return;
            }

            // do a shallow clone so the slug property can differ
            doc[key] = _.clone(doc.localized[locale][key]);

            console.log("  Setting", key, " to ",locale);

          });



        });




        return setImmediate(callback);






      }
    });


  }



};
