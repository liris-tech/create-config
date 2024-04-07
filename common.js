import { Meteor } from 'meteor/meteor';

import _ from 'lodash';

// =================================================================================================

/**
 * Access sub-parts of a static configuration object merged with its dynamic counterpart from Meteor
 * collections.
 *
 * @param {Object} staticPart The static configuration object. Used as the fallback.
 * @param {Array<{collection, selector, pathPrefix}>} [dynamicPart=[]] An optional array of objects
 * describing in which order and how collections need to be queried before potentially falling back
 * to the static part. The objects contained in the array shall be sorted in decreasing order of
 * authority.
 * @returns {Function} A function returning the sub-part of the merged configuration. Its first
 * argument is the path into the merged configuration and the second is the staticPart.
 *
 * @example
 * const defaults = {screen: {height: 'large', width: 'medium'}};
 *
 * // Result of querying Meteor.users.findOne(Meteor.userId(), {fields: {settings: 1}}):
 * {_id: 'current/user/id', {settings: {screen: {height: 'small'}}}}
 *
 * const getConfig = createConfig(defaults,
 *     [{collection: Meteor.users, selector: () => {_id: Meteor.userId()}, pathPrefix: ['settings']}]);
 *
 * getConfig('screen.height')
 * // => returns 'small' as 'screen.height' is specified in the user document, it takes precedence.
 *
 * getConfig(['screen', 'width'])
 * // => returns 'medium' as 'screen.width' is not specified in the user document.
 *
 * getConfig('screen')
 * // => returns {height: 'small', width: 'medium'} thanks to the merge.
 */
export function createConfig(staticPart, dynamicPart=[]) {
    return (path, opts={}, config=staticPart) => {
        const _path =
            _.isString(path) ? path.split('.')
          : _.isArray(path) ? path
          : _.isUndefined(path) ? []
          : new Error(`path should be a string or an array. Received: ${path})`);
        if (_.isError(_path)) throw _path;

        const valuesFromDb = _(dynamicPart)
            .map(spec => {
                const {collection, selector, pathPrefix} = spec;

                const _collection =
                    _.isFunction(collection) ? collection(opts)
                  : collection?.find ? collection
                  : new Error(`collection should either be a function or a Meteor Collection. Received ${collection} (in ${spec})`);

                const _selector =
                    _.isFunction(selector) ? selector(opts)
                  : _.isPlainObject(selector) ? selector
                  : new Error(`selector should either be a function or an object. Received ${selector} (in ${spec})`);
                if (_.isError(_selector)) throw _selector;

                const _pathPrefix =
                    _.isString(pathPrefix) ? pathPrefix.split('.')
                  : _.isArray(pathPrefix) ? pathPrefix
                  : _.isUndefined(pathPrefix) ? []
                  : new Error(`keyPrefix should be a string or an array. Received: ${pathPrefix} (in ${spec})`);
                if (_.isError(_pathPrefix)) throw _pathPrefix;

                const pathInDocument = _pathPrefix.concat(_path).join('.');

                // restraining the fields of the query only on the client, in case it is executed
                // in a reactive context.
                const doc = Meteor.isClient
                    ? _collection.findOne(_selector, {fields: {[pathInDocument]: 1}})
                    : _collection.findOne(_selector);

                return _.get(doc, pathInDocument);
            })
            .filter(_.negate(_.isNil))
            .value();

        if (valuesFromDb.length) {
            const valueFromStaticPart = _.get(config, _path);
            if (_.isNil(valueFromStaticPart)) {
                throw new Error(`Configuration needs to be defined for staticPart at path: ${path}`);
            }

            // we want to merge in increasing order of importance.
            const allValues = _.reverse(valuesFromDb.concat(valueFromStaticPart));
            return _.mergeWith({}, ...allValues, (left, right) => {
               if (_.isArray(right)) {
                   // right wins. No merging of arrays.
                   return right;
               }
               else if (_.isArray(left)) {
                   if (_.isNil(right)) {
                       // undefined or null should not overwrite left.
                       return left;
                   }
                   else {
                       return right;
                   }
               }
            });
        }
        else {
            return _.get(config, _path);
        }
    }
}