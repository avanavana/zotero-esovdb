#!/usr/bin/env node

/**
 * @file zotero-esovdb (zotvid)
 * @author Avana Vana <dear.avana@gmail.com>
 * @version 1.5.0
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { version } = require('../package.json');
const { program } = require('../config');
const dotenv = require('dotenv').config({
  path: path.join(__dirname, '../', '.env'),
});

const esovdbHeaders = {
  'User-Agent': 'zotero-esovdb/' + version || '1.5.0',
};

const zoteroHeaders = {
  Authorization: 'Bearer ' + process.env.ZOTERO_API_KEY,
  'Zotero-API-Version': '3',
  'User-Agent': 'zotero-esovdb/' + version || '1.5.0',
};

const zoteroLibrary = axios.create({
  baseURL: `https://api.zotero.org/groups/2764885/`,
  headers: zoteroHeaders,
});

zoteroLibrary.defaults.headers.post['Content-Type'] = 'application/json';

const zotero = axios.create({
  baseURL: 'https://api.zotero.org/',
  headers: zoteroHeaders,
});

const esovdb = axios.create({
  baseURL: `https://api.esovdb.org/v1/`,
  headers: esovdbHeaders,
});

esovdb.defaults.headers.post['Content-Type'] = 'application/json';

/** @constant {Map} collections - Maps parent collections names from the ESOVDB to parent collection IDs in the Zotero library */
const collections = new Map([
  ['series', 'HYQEFRGR'],
  ['topics', 'EGB8TQZ8'],
]);

/** @constant {Map} tables - Maps request table params to their proper names on the ESOVDB */
const tables = new Map([
  ['videos', 'Videos'],
  ['series', 'Series'],
  ['topics', 'Topics'],
  ['tags', 'Tags'],
  ['organizations', 'Organizations'],
  ['people', 'People'],
  ['submissions', 'Submissions'],
  ['issues', 'Issues'],
]);

/** @constant {Map} topics - Maps ESOVDB topics to their collection keys in Zotero */
// prettier-ignore
const topics = new Map([['Mantle Geodynamics, Geochemistry, Convection, Rheology, & Seismic Imaging and Modeling', '5XQD67DA'],
['Igneous & Metamorphic Petrology, Volcanism, & Hydrothermal Systems', 'L6JMIGTE'],
['Alluvial, Pluvial & Terrestrial Sedimentology, Erosion & Weathering, Geomorphology, Karst, Groundwater & Provenance', 'BV7G3CIC'],
['Early Earth, Life\'s Origins, Deep Biosphere, and the Formation of the Planet', '9DK53U7F'],
['Geological Stories, News, Tours, & Field Trips', 'XDFHQTC3'],
['History, Education, Careers, Field Work, Economic Geology, & Technology', 'M4NKIHBK'],
['Glaciation, Atmospheric Science, Carbon Cycle, & Climate', 'AD997U4T'],
['The Anthropocene', 'P2WNJD9N'],
['Geo-Archaeology', 'UJDCHPB5'],
['Paleoclimatology, Isotope Geochemistry, Radiometric Dating, Deep Time, & Snowball Earth', 'L4PLXHN8'],
['Seafloor Spreading, Oceanography, Paleomagnetism, & Geodesy', 'NPDV3BHH'],
['Tectonics, Terranes, Structural Geology, & Dynamic Topography', 'U3JYUDHI'],
['Seismology, Mass Wasting, Tsunamis, & Natural Disasters', '63TE3Y26'],
['Minerals, Mining & Resources, Crystallography, & Solid-state Chemistry', 'YY5W7DB8'],
['Marine & Littoral Sedimentology, Sequence Stratigraphy, Carbonates, Evaporites, Coal, Petroleum, and Mud Volcanism', '37J3LYFL'],
['Planetary Geology, Impact Events, Astronomy, & the Search for Extraterrestrial Life', 'HLV7WMZQ'],
['Paleobiology, Mass Extinctions, Fossils, & Evolution', 'VYWX6R2B']]);

/**
 *  Wraps console.log to disable any calls to it if program is run with -s ({@link silent}=true) enabled
 *
 *  @function log
 *  @param {*} data - Data that should be logged through console.log if {@link silent} is false
 *  @param {boolean} overrideSilent - Optional boolean that can be passed to log messages despite the -s ({@link silent}) option being enabled
 */
const log = (data, overrideSilent = false) => {
  if (!program.silent || overrideSilent) console.log(data);
};

/**
 *  Utility sleep function based on units of seconds that returns a promise and can be consumed by async/await
 *
 *  @function sleep
 *  @param {number} seconds - The number of seconds to sleep for (i.e. the number of seconds after which the promise will resolve)
 *  @returns {Promise} Resolves after a specified [number]{@link ms} of seconds
 */

const sleep = (seconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });

/**
 *  Sequentially reduces the results of one or more asynchronous functions, accumulating their results, in order
 *
 *  @async
 *  @function queueAsync
 *  @param {Array} functor - An array of anything, a functor, something mappable (e.g. Array.prototype.map())
 *  @returns {Array} An array of values sequentially accumulated from each asynchronous function performed on the functor
 */

const queueAsync = async (functor) => {
  const res = [];

  functor.length > 1
    ? await functor.reduce((a, c, i, { length }) =>
        (i === 1 ? a() : a).then((val) => {
          res.push(val);
          return i === length - 1 ? c().then((val) => res.push(val)) : c();
        })
      )
    : await functor[0]().then((val) => res.push(val));

  return res;
};

/**
 *  Retrieves videos from the ESOVDB API proxy cache based on parameters passed through the CLI
 *
 *  @async
 *  @function getVideos
 *  @requires axios
 *  @param {Object} params - Object representing the state of all parameters passed through the CLI, maxRecords, pageSize, modifiedAfter, and createdAfter
 *  @param {?number} params.maxRecords - Optional upper limit on number of videos to return from the ESOVDB, from most to least recent
 *  @param {number} [params.pageSize=100] - Number of records to return per page request to Airtable via ESOVDB API proxy cache (default: 100)
 *  @param {?string} params.modifiedAfter - URL-encoded date string, formatted through Date.toLocaleString()
 *  @param {?string} params.createdAfter - URL-encoded date string, formatted through Date.toLocaleString()
 *  @returns {Object[]} - Array of video objects filtered according to {@link params} with all necessary fields extracted from the ESOVDB
 */

const getVideos = async (params) => {
  log(
    `Retrieving ${params.maxRecords ? params.maxRecords : 'all'} videos, ${
      params.pageSize ? params.pageSize + ' per page' : '100 per page'
    }${
      params.modifiedAfter
        ? ', modified after ' + decodeURIComponent(params.modifiedAfter)
        : ''
    }${
      params.createdAfter
        ? ', created after ' + decodeURIComponent(params.createdAfter)
        : ''
    }...`
  );

  try {
    const response = await esovdb.get('videos/query', { params: params });

    if (response && response.data.length > 0) {
      // prettier-ignore
      log(chalk.green(`› Successfully retrieved ${response.data.length} videos.`));
      return response.data;
    } else {
      throw new Error('Failed to retreive videos from the ESOVDB.');
    }
  } catch (err) {
    console.error(chalk.bold.red(err.message));
  }
};

/**
 *  Updates specified fields for given items in a specified ESOVDB table via proxy cache server and then returns the result for logging
 *
 *  @async
 *  @function updateTable
 *  @requires axios
 *  @param {Object[]} items - An array of objects formatted as updates for Airtable (i.e. [ { id: 'recordId', fields: { 'Airtable Field': 'value', ... } }, ... ])
 *  @returns {Object[]} The original array of Zotero items, {@link items}, returned from the ESOVDB API proxy cache after processing
 */

const updateTable = async (items, table) => {
  // prettier-ignore
  log(`Updating ${Object.keys(items[0].fields)
    .map((field) => `"${field}"`)
    .join(', ')} in "${tables.get(table)}" for ${items.length} item${items.length === 1 ? '' : 's'} on the ESOVDB...`);

  try {
    // prettier-ignore
    const response = await esovdb.post(`${table}/update`, JSON.stringify(items));

    if (response.status === 200) {
      return JSON.parse(response.config.data);
    } else {
      // prettier-ignore
      throw new Error(`Couldn't update ${items.length} item${items.length === 1 ? '' : 's'} on the ESOVDB.`);
    }
  } catch (err) {
    console.error(chalk.bold.red(err.message));
  }
};

/**
 *  Fetches a fresh 'videoRecording' template from Zotero with which to structure items in posts to the Zotero API
 *
 *  @async
 *  @function getTemplate
 *  @requires axios
 *  @returns {Object} A Zotero new item template of type 'videoRecording'
 *
 *  @see [Zotero Web API 3.0 › Types & Fields › Getting a Template for a New Item]{@link https://www.zotero.org/support/dev/web_api/v3/types_and_fields#getting_a_template_for_a_new_item}
 */

const getTemplate = async () => {
  log('Retrieving template from Zotero...');
  try {
    // prettier-ignore
    const response = await zotero.get('items/new', { params: { itemType: 'videoRecording' } });

    if (response.data) {
      log(chalk.green('› Successfully retrieved template.'));
      return response.data;
    } else {
      throw new Error(`Couldn't get template from Zotero.`);
    }
  } catch (err) {
    console.error(chalk.bold.red(err.message));
  }
};

/**
 *  Posts a new collection to the ESOVDB public Zotero library.
 *
 *  @async
 *  @function createCollection
 *  @requires axios
 *  @param {string} name - The name of the collection to create in Zotero
 *  @param {('series'|'topics')} parent - String representing the parent collection, one of either 'series' or 'topics' (for the time being)
 *  @returns {ZoteroResponse} An object containing an array of successfully added or updated Zotero item objects, an array of Zotero item keys of unchanged Zotero items, and an array of Zotero item objects of Zotero items which failed to be added or updated
 *
 *  @see [Zotero Web API 3.0 › Write Requests › Creating a Collection]{@link https://www.zotero.org/support/dev/web_api/v3/write_requests#creating_a_collection}
 */

const createCollection = async (name, parent) => {
  try {
    if (collections.get(parent)) {
      // prettier-ignore
      log(`No ${parent} collection named "${name}", creating new collection...`);
      // prettier-ignore
      return await zoteroLibrary.post('zotero/collections', [{ name: name, parentCollection: collections.get(parent) }]);
    } else {
      throw new Error('Unrecognized subcollection type.');
    }
  } catch (err) {
    console.error(chalk.bold.red(err.message));
  }
};

/**
 * @typedef {Object} ZoteroResponse
 * @property {?Object[]} successful - An array of succesfully added or updated Zotero item objects
 * @property {?string[]} unchanged - An array of Zotero item keys of Zotero items which remained unchanged after the POST request either because no changes were sent or the version sent was outdated
 * @property {?Object[]} failed - An array of Zotero item objects which failed in their attempts to be added or updated, perhaps due to format/syntactical or structural errors
 */

/**
 *  Adds or updates one or more items in a Zotero Library depending on whether a given item object is passed with Zotero key and version properties and returns a {@link ZoteroResponse} object from the Zotero API.  Failed items are also written to failed.json for forensic/debugging purposes.
 *
 *  @async
 *  @function postItems
 *  @requires fs
 *  @requires axios
 *  @param {Object[]} items - An array of objects formatted as Zotero items according to the Zotero Web API 3.0 docs
 *  @returns {ZoteroResponse} An object containing an array of successfully added or updated Zotero item objects, an array of Zotero item keys of unchanged Zotero items, and an array of Zotero item objects of Zotero items which failed to be added or updated
 *
 *  @see [Zotero Web API 3.0 › Write Requests › Creating Multiple Objects]{@link https://www.zotero.org/support/dev/web_api/v3/write_requests#creating_multiple_objects}
 */

const postItems = async (items) => {
  try {
    const response = await zoteroLibrary.post('items', items);

    const successful = Object.values(response.data.successful);
    const unchanged = Object.values(response.data.unchanged);
    const failed = Object.values(response.data.failed);

    if (successful.length > 0) {
      // prettier-ignore
      log(chalk.green(`› Successfully posted ${successful.length} item${successful.length === 1 ? '' : 's'}.`));
    }

    if (unchanged.length > 0) {
      // prettier-ignore
      log(`› ${unchanged.length} item${unchanged.length === 1 ? '' : 's'} left unchanged.`);
    }

    if (failed.length > 0) {
      // prettier-ignore
      console.error(chalk.bold.red(`› Failed to post ${failed.length} video${failed.length === 1 ? '' : 's'}.`));

      // prettier-ignore
      fs.writeFile('failed.json', JSON.stringify(response.data.failed), 'utf8', (err) => {
        if (err) throw new Error('An error occured while writing JSON Object to File.');
      });
    }

    return { successful, unchanged, failed };
  } catch (err) {
    console.error(chalk.bold.red(err.message));
  }
};

/**
 *  Converts raw data for a single video from the ESOVDB into a format that can be accepted by Zotero in a single- or multiple-item write request
 *
 *  @async
 *  @function formatItems
 *  @requires fs
 *  @param {Object} video - An object representing a video from the ESOVDB, retrieved from the ESOVDB either through the API or through Airtable's automation feature
 *  @param {Object} template - A valid Zotero item template, retrieved from Zotero using {@link getTemplate}
 *  @returns {Object} A properly-formatted and populated object for use in either a single-item or multiple-item Zotero write request
 *
 *  @see [Zotero Web API 3.0 › Write Requests › Item Requests]{@link https://www.zotero.org/support/dev/web_api/v3/write_requests#item_requests}
 */

const formatItems = async (video, template) => {
  let extras = [];

  if (video.topic) extras.push({ title: 'Topic', value: video.topic });
  if (video.location) extras.push({ title: 'Location', value: video.location });
  if (video.plusCode)
    extras.push({ title: 'Plus Code', value: video.plusCode });
  if (video.learnMore)
    extras.push({ title: 'Learn More', value: video.learnMore });

  const presenters =
    video.presenters.length > 0
      ? video.presenters.map((presenter) => {
          if (presenter.lastName !== 'Unknown') {
            return !presenter.firstName || !presenter.lastName
              ? {
                  creatorType: 'contributor',
                  name: presenter.firstName || '' + presenter.lastName || '',
                }
              : {
                  creatorType: 'contributor',
                  firstName: presenter.firstName,
                  lastName: presenter.lastName,
                };
          }
        })
      : [];

  const payload = {
    ...template,
    itemType: 'videoRecording',
    title: video.title,
    creators: presenters,
    abstractNote: video.desc,
    videoRecordingFormat: video.format,
    seriesTitle: video.series,
    volume: video.vol ? `${video.vol}:${video.no}` : video.no,
    numberOfVolumes: video.seriesCount > 1 ? video.seriesCount : '',
    place: video.provider,
    studio: video.publisher,
    date: video.year,
    runningTime: video.runningTime,
    language: video.language,
    ISBN: '',
    shortTitle: '',
    url: video.url,
    accessDate: video.accessDate,
    archive: 'Earth Science Online Video Database',
    archiveLocation:
      'https://airtable.com/tbl3WP689vHdmg7P2/viwD9Tpr6JAAr97CW/' +
      video.recordId,
    libraryCatalog: '',
    callNumber: video.esovdbId,
    rights: '',
    extra: extras.map((item) => item.title + ': ' + item.value).join('\n'),
    tags: [],
    collections: topics.get(video.topic) ? [topics.get(video.topic)] : [],
    relations: {},
  };

  if (video.zoteroKey && video.zoteroVersion) {
    payload.key = video.zoteroKey;
    payload.version = video.zoteroVersion;
  }

  if (video.series) {
    if (video.zoteroSeries) {
      payload.collections.push(video.zoteroSeries);
    } else {
      try {
        const { data } = await createCollection(video.series, 'series');

        if (data.success && Object.values(data.success).length > 0) {
          // prettier-ignore
          log(chalk.green(`› Successfully created collection "${video.series}" under "Series".`));
          payload.collections.push(data.success[0]);
          // prettier-ignore
          const updateSeriesResponse = await updateTable([{ id: video.seriesId, fields: { 'Zotero Collection': data.success[0] } }], 'series');

          if (updateSeriesResponse && updateSeriesResponse.length > 0) {
            // prettier-ignore
            log(chalk.bold.green('› Successfully synced series collection key with the ESOVDB.'));
          } else {
            // prettier-ignore
            throw new Error('Failed to sync series collection key with the ESOVDB');
          }
        } else {
          // prettier-ignore
          const message = data.failed.length > 1 && data.failed[0].message ? data.failed[0].message : '';
          // prettier-ignore
          throw new Error(`Failed to create series collection${message ? ' (' + message + ')' : ''}.`);
        }
      } catch (err) {
        console.error(chalk.bold.red(err.message));
      }
    }
  }

  return payload;
};

(async () => {
  try {
    const params = {};
    program.parse(process.argv);

    if (program.maxRecords) params.maxRecords = program.maxRecords;
    if (program.pageSize) params.pageSize = program.pageSize;

    if (program.createdAfter && program.modifiedAfter) {
      if (
        Object.keys(program).indexOf('createdAfter') >
        Object.keys(program).indexOf('modifiedAfter')
      ) {
        params.createdAfter = program.createdAfter;
      } else {
        params.modifiedAfter = program.modifiedAfter;
      }
    } else {
      if (program.createdAfter) params.createdAfter = program.createdAfter;
      if (program.modifiedAfter) params.modifiedAfter = program.modifiedAfter;
    }

    const videos = await getVideos(params);

    if (videos && videos.length > 0) {
      if (program.json) {
        try {
          // prettier-ignore
          fs.writeFileSync('videos.json', JSON.stringify(videos), 'utf8', (err) => {
              if (err) throw new Error('An error occured while writing JSON Object to File.');
          });

          process.exit();
        } catch (err) {
          console.error(chalk.bold.red(err.message));
          process.exit(1);
        }
      }

      const template = await getTemplate();
      let items = await queueAsync(
        videos.map((video) => () => formatItems(video, template))
      );

      let i = 0,
        totalSuccessful = 0,
        totalUnchanged = 0,
        totalFailed = 0,
        posted = [],
        queue = items.length;

      while (items.length) {
        log(
          `Posting item${items.length === 1 ? '' : 's'} ${
            i * program.chunkSize + 1
          }${items.length > 1 ? '-' : ''}${
            items.length > 1
              ? i * program.chunkSize +
                (items.length < program.chunkSize
                  ? items.length
                  : program.chunkSize)
              : ''
          } of ${queue} total to Zotero...`
        );
        // prettier-ignore
        let { successful, unchanged, failed } = await postItems(items.splice(0, program.chunkSize));
        if (successful.length > 0) posted = [...posted, ...successful];
        totalSuccessful += successful.length;
        totalUnchanged += unchanged.length;
        totalFailed += failed.length;
        if (items.length > program.chunkSize) await sleep(program.waitSecs);
        i++;
      }

      log(chalk.bold('Zotero response summary:'));
      // prettier-ignore
      if (totalSuccessful > 0) log(chalk.bold.green(`› [${totalSuccessful}] item${totalSuccessful === 1 ? '' : 's'} total added or updated.`));
      // prettier-ignore
      if (totalUnchanged > 0) log(chalk.bold(`› [${totalUnchanged}] item${totalUnchanged === 1 ? '' : 's'} total left unchanged.`));
      // prettier-ignore
      if (totalFailed > 0) log(chalk.bold.red(`› [${totalFailed}] item${totalFailed === 1 ? '' : 's'} total failed to add or update.`));

      if (posted.length > 0) {
        const itemsToSync = posted.map((item) => ({
          id: item.data.archiveLocation.match(/rec[\w]{14}$/)[0],
          fields: {
            'Zotero Key': item.key,
            'Zotero Version': item.version,
          },
        }));

        const updated = await updateTable(itemsToSync, 'videos');

        if (updated && updated.length > 0) {
          // prettier-ignore
          log(chalk.bold.green(`› [${updated.length}] item${updated.length === 1 ? "'s" : "s'"} Zotero key and version synced with the ESOVDB.`));
        } else {
          throw new Error('Error syncing items with the ESOVBD.');
        }
      }
    } else {
      throw new Error('No videos retrieved from the ESOVBD.');
    }
  } catch (err) {
    console.error(chalk.bold.red(err.message));
  }
})();
