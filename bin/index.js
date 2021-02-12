#!/usr/bin/env node

/**
 * @file zotero-esovdb
 * @author Avana Vana <dear.avana@gmail.com>
 * @version 1.3.0
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { version } = require('../package.json');
const dotenv = require('dotenv').config({
  path: path.join(__dirname, '../', '.env'),
});

const { program } = require('commander');
program
  .name(chalk.bold('zotvid'))
  .usage(
    `[ ${chalk.bold('-m')} <${chalk.underline('number')}> ] [ ${chalk.bold(
      '--max-records'
    )}=<${chalk.underline('number')}> ] [ ${chalk.bold(
      '-p'
    )} <${chalk.underline('number')}> ] [ ${chalk.bold(
      '--page-size'
    )}=<${chalk.underline('number')}> ] [ ${chalk.bold(
      '-c'
    )} <${chalk.underline('number')}> ] [ ${chalk.bold(
      '--chunk-size'
    )}=<${chalk.underline('number')}>] [ ${chalk.bold('-w')} <${chalk.underline(
      'secs'
    )}>] [ ${chalk.bold('--wait-secs')}=<${chalk.underline(
      'secs'
    )}>] [ ( ${chalk.bold('-C')} <${chalk.underline('date')}> | ${chalk.bold(
      '-M'
    )} <${chalk.underline('date')}> ) ] [ ( ${chalk.bold(
      '--created-after'
    )}=<${chalk.underline('date')}> | ${chalk.bold(
      '--modified-after'
    )}=<${chalk.underline('date')}> ) ] [ ${chalk.bold('-j')} ] [ ${chalk.bold(
      '--json'
    )} ] [ ${chalk.bold('-s')} ] [ ${chalk.bold('--silent')} ] [ ${chalk.bold(
      '-v'
    )} ] [ ${chalk.bold('--version')} ] [ ${chalk.bold('-h')} ] [ ${chalk.bold(
      '--help'
    )} ]`
  )
  .description(
    'Gets a specified number of records from the ESOVDB (Earth Science Online Video Database), adds them as items in a Zotero library, and then re-syncs the new Zotero version number or newly assigned Zotero keys with the ESOVDB.  Uses airtable-api-proxy (https://github.com/avanavana/airtable-api-proxy) for communicating with both the Airtable and Zotero APIs.'
  )
  .version(
    version || '1.4.0',
    '-v, --version',
    `Displays the current version of ${chalk.bold('zotvid')}.`
  )
  .option(
    '-m, --max-records <number>',
    `Total ${chalk.underline(
      'number'
    )} of items to add to Zotero. (default: all items)`,
    (int) => parseInt(int)
  )
  .option(
    '-p, --page-size <number>',
    `Maximum ${chalk.underline(
      'number'
    )} of items (≤100) to retrieve from ESOVDB for each individual page request. (default: 100)`,
    (int) => parseInt(int > 100 ? 100 : int)
  )
  .option(
    '-c, --chunk-size <number>',
    `Maxmimum ${chalk.underline(
      'number'
    )} of items (≤50) to add to Zotero in a single request, to avoid rate-limiting.`,
    (int) => parseInt(int > 50 ? 50 : int),
    50
  )
  .option(
    '-w, --wait-secs <secs>',
    `${chalk.underline(
      'Number'
    )} of seconds to wait between Zotero requests, to avoid rate-limiting.`,
    (int) => parseInt(int),
    10
  )
  .option(
    '-C, --created-after <date>',
    `Include only records created after a specified ${chalk.underline(
      'date'
    )}. Assumes GMT if time is excluded—if included, ${chalk.bold(
      'zotvid'
    )} uses the local timezone. Excludes option ${chalk.bold(
      '-M'
    )}/${chalk.bold('--modified-after')}).`,
    (date) => {
      const uModifiedDate = Date.parse(date);
      if (typeof uModifiedDate === 'number' && uModifiedDate > 0) {
        const modifiedDate = new Date(uModifiedDate);
        return encodeURIComponent(modifiedDate.toLocaleString());
      } else {
        const modifiedDate = new Date();
        return encodeURIComponent(modifiedDate.toLocaleString());
      }
    }
  )
  .option(
    '-M, --modified-after <date>',
    `Include only records modified after a specified ${chalk.underline(
      'date'
    )}. Assumes GMT if time is excluded—if included, ${chalk.bold(
      'zotvid'
    )} uses the local timezone. Excludes option ${chalk.bold(
      '-C'
    )}/${chalk.bold('--created-after')}).`,
    (date) => {
      const uModifiedDate = Date.parse(date);
      if (typeof uModifiedDate === 'number' && uModifiedDate > 0) {
        const modifiedDate = new Date(uModifiedDate);
        return encodeURIComponent(modifiedDate.toLocaleString());
      } else {
        const modifiedDate = new Date();
        return encodeURIComponent(modifiedDate.toLocaleString());
      }
    }
  )
  .option('-j, --json', 'Retrieve raw json without syncing with Zotero.')
  .option('-s, --silent', 'Run without any logging.')
  .helpOption('-h, --help', 'Display this help file.')
  .on('--help', () => {
    console.log('\nExamples:\n');
    console.log('  $ zotvid\n  Syncs all records in the ESOVDB with Zotero.\n');
    console.log(
      '  $ zotvid -m 9 -p 3\n  Gets the latest 9 records in 3 separate Airtable API calls and syncs them with\n  a Zotero library.\n'
    );
    console.log(
      '  $ zotvid -M "2020-12-31 00:00 am"\n  Syncs all records modified since Dec 31, 2020 at midnight and syncs them with\n  a Zotero library.\n'
    );
    console.log(
      '  $ zotvid -j\n  Gets all records in the ESOVDB and downloads them to a json file.'
    );
  });

const esovdbHeaders = {
  'User-Agent': 'zotero-esovdb/' + version || '1.1.0',
};

const zoteroHeaders = {
  Authorization: 'Bearer ' + process.env.ZOTERO_API_KEY,
  'Zotero-API-Version': '3',
  'User-Agent': 'zotero-esovdb/' + version || '1.1.0',
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
  baseURL: `${process.env.ESOVDB_PROXY_CACHE}/esovdb/`,
  headers: esovdbHeaders,
});

esovdb.defaults.headers.post['Content-Type'] = 'application/json';

const log = (data) => {
  if (!program.silent) console.log(data);
};

const sleep = (seconds) => {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
};

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
    const response = await esovdb.get('videos/list', { params: params });

    if (response && response.data.length > 0) {
      log(
        chalk.green(`› Successfully retrieved ${response.data.length} videos.`)
      );

      return response.data;
    } else {
      throw new Error(err);
    }
  } catch (err) {
    console.error(chalk.bold.red(err.message));
  }
};

const updateVideos = async (items) => {
  log(
    `Updating Zotero key and version for ${items.length} item${
      items.length > 1 ? 's' : ''
    } on the ESOVDB...`
  );

  try {
    const response = await esovdb.post('videos/update', JSON.stringify(items));

    if (response.status === 200) {
      return JSON.parse(response.config.data);
    } else {
      let error = `Couldn't update ${items.length} item${
        items.length > 1 ? 's' : ''
      } on the ESOVDB.`;
      console.error(chalk.bold.red(error));

      throw new Error(error);
    }
  } catch (err) {
    console.error(chalk.bold.red(err.message));
    throw new Error(err);
  }
};

const getTemplate = async () => {
  log('Retrieving template from Zotero...');
  try {
    const response = await zotero.get('items/new', {
      params: { itemType: 'videoRecording' },
    });

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

const postItems = async (items) => {
  try {
    const response = await zoteroLibrary.post('items', items);

    const successful = Object.values(response.data.successful);
    const unchanged = Object.values(response.data.unchanged);
    const failed = Object.values(response.data.failed);

    if (successful.length > 0) {
      log(
        chalk.green(
          `› Successfully posted ${successful.length} item${
            successful.length > 1 ? 's' : ''
          }.`
        )
      );
    }

    if (unchanged.length > 0) {
      log(
        `› ${unchanged.length} item${
          unchanged.length > 1 ? 's' : ''
        } left unchanged.`
      );
    }

    if (failed.length > 0) {
      console.error(
        chalk.bold.red(
          `› Failed to post ${failed.length} video${
            failed.length > 1 ? 's' : ''
          }.`
        )
      );

      fs.writeFile(
        'failed.json',
        JSON.stringify(response.data.failed),
        'utf8',
        (err) => {
          if (err)
            throw new Error(
              'An error occured while writing JSON Object to File.'
            );
        }
      );
    }

    return { successful: successful, unchanged: unchanged, failed: failed };
  } catch (err) {
    console.error(chalk.bold.red(err.message));
  }
};

const formatItems = (video, template) => {
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
    collections: [],
    relations: {},
  };

  if (video.zoteroKey && video.zoteroVersion) {
    payload.key = video.zoteroKey;
    payload.version = video.zoteroVersion;
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
          fs.writeFileSync(
            'videos.json',
            JSON.stringify(videos),
            'utf8',
            (err) => {
              if (err)
                throw new Error(
                  'An error occured while writing JSON Object to File.'
                );
            }
          );

          process.exit();
        } catch (err) {
          console.error(chalk.bold.red(err.message));
          process.exit(1);
        }
      }

      const template = await getTemplate();
      let items = videos.map((video) => formatItems(video, template));

      let i = 0,
        totalSuccessful = 0,
        totalUnchanged = 0,
        totalFailed = 0,
        posted = [],
        queue = items.length;

      while (items.length) {
        log(
          `Posting item${items.length > 1 ? 's' : ''} ${
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

        let { successful, unchanged, failed } = await postItems(
          items.splice(0, program.chunkSize)
        );

        if (successful.length > 0) posted = [...posted, ...successful];

        totalSuccessful += successful.length;
        totalUnchanged += unchanged.length;
        totalFailed += failed.length;

        if (items.length > program.chunkSize) await sleep(program.waitSecs);

        i++;
      }

      log(chalk.bold('[DONE] Posted to Zotero:'));

      if (totalSuccessful > 0)
        log(
          chalk.bold.green(
            `› [${totalSuccessful}] item${
              totalSuccessful > 1 ? 's' : ''
            } total added or updated.`
          )
        );

      if (totalUnchanged > 0)
        log(
          chalk.bold(
            `› [${totalUnchanged}] item${
              totalUnchanged > 1 ? 's' : ''
            } total left unchanged.`
          )
        );

      if (totalFailed > 0)
        log(
          chalk.bold.red(
            `› [${totalUnchanged}] item${
              totalFailed > 1 ? 's' : ''
            } total failed to add or update.`
          )
        );

      if (posted.length > 0) {
        const itemsToSync = posted.map((item) => ({
          id: item.data.archiveLocation.match(/rec[\w]{14}$/)[0],
          fields: {
            'Zotero Key': item.key,
            'Zotero Version': item.version,
          },
        }));

        const updated = await updateVideos(itemsToSync);

        if (updated && updated.length > 0) {
          log(
            chalk.bold.green(
              `› [${updated.length}] item${
                updated.length > 1 ? "s'" : "'s"
              } Zotero key and version synced with the ESOVDB.`
            )
          );
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
