#!/usr/bin/env node

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
  .description(
    'Gets a specified number of records from the ESOVDB and adds them as items in a Zotero library.'
  )
  .version(
    version || '1.0.0',
    '-v, --version',
    `Displays the current version of ${chalk.bold('zotlib')}.`
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
    )} of items to retrieve from ESOVDB for each individual page request, ≤100. (default: 100)`,
    (int) => parseInt(int > 100 ? 100 : int)
  )
  .option(
    '-C, --created-after <date>',
    `Include only records created after a specified ${chalk.underline(
      'date'
    )}. Assumes GMT if time is excluded—if included, ${chalk.bold(
      'zotlib'
    )} uses the local timezone. Excludes option ${chalk.bold(
      '-M'
    )} ${chalk.bold('--modified-after')}).`,
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
      'zotlib'
    )} uses the local timezone. Excludes option ${chalk.bold(
      '-C'
    )} ${chalk.bold('--created-after')}).`,
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
    '-c, --chunk-size <number>',
    `Maxmimum ${chalk.underline(
      'number'
    )} of items to add to Zotero in a single request, ≤50.`,
    (int) => parseInt(int > 50 ? 50 : int),
    50
  )
  .option(
    '-w, --wait-secs <number>',
    `${chalk.underline('Number')} of seconds to wait between Zotero requests.`,
    (int) => parseInt(int),
    10
  )
  .option('-j, --json', 'Retrieve raw json without adding to Zotero.')
  .option('-s, --silent', 'Run without any logging.')
  .helpOption('-h, --help', 'Display this help file.');

const esovdbHeaders = {
  'User-Agent': 'zotero-esovdb/' + version || '1.1.0',
};

const zoteroHeaders = {
  Authorization: 'Bearer ' + process.env.ZOTERO_API_KEY,
  'Zotero-API-Version': '3',
  'User-Agent': 'zotero-esovdb/' + version || '1.1.0',
};

const zoteroLibrary = axios.create({
  baseURL: `https://api.zotero.org/users/${process.env.ZOTERO_USER}/`,
  headers: zoteroHeaders,
});

zoteroLibrary.defaults.headers.post['Content-Type'] = 'application/json';

const zotero = axios.create({
  baseURL: 'https://api.zotero.org/',
  headers: zoteroHeaders,
});

const esovdb = axios.create({
  baseURL: `https://${process.env.ESOVDB_PROXY_CACHE}/esovdb/`,
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
    }

    return response.data;
  } catch (err) {
    console.error(chalk.bold.red(err));
    throw new Error(err);
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
      console.error(
        chalk.bold.red(
          `[ERROR] Couldn't update ${items.length} item${
            items.length > 1 ? 's' : ''
          } on the ESOVDB.`
        )
      );

      throw new Error(err);
    }
  } catch (err) {
    console.error(chalk.bold.red(err));
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
    }
    return response.data;
  } catch (err) {
    console.error(chalk.bold.red(err));
    throw new Error(err);
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
      console.error(chalk.bold.red(`› Failed to add ${failed.length} videos.`));
      const failedItems = JSON.stringify(response.data.failed);

      fs.writeFile('failed.json', failedItems, 'utf8', (err) => {
        if (err) {
          console.error(
            chalk.bold.red(
              '[ERROR] An error occured while writing JSON Object to File.'
            )
          );
        }
      });
    }

    return { successful: successful, unchanged: unchanged, failed: failed };
  } catch (err) {
    console.error(err);
    throw new Error(err);
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
    collections: ['7J7AJ2BH'],
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
        const json = JSON.stringify(videos);

        fs.writeFileSync('videos.json', json, 'utf8', (err) => {
          if (err) {
            console.error(
              chalk.bold.red(
                '[ERROR] An error occured while writing JSON Object to File.'
              )
            );
          }
        });

        process.exit();
      }

      const template = await getTemplate();
      let items = videos.map((video) => formatItems(video, template));

      let i = 0,
        totalSuccessful = 0,
        totalUnchanged = 0,
        totalFailed = 0,
        posted = [],
        queue = items.length;

      while (items.length > 0) {
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
          items.slice(0, program.chunkSize)
        );

        if (successful.length > 0) posted = [...posted, ...successful];

        totalSuccessful += successful.length;
        totalUnchanged += unchanged.length;
        totalFailed += failed.length;

        if (items.length > program.chunkSize) await sleep(program.waitSecs);
        i++, (items = items.slice(program.chunkSize));
      }

      log(chalk.bold('[DONE] Posted to Zotero:'));

      if (totalSuccessful > 0)
        log(
          chalk.bold.green(
            `› [${totalSuccessful}] new item${
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
          console.error(chalk.bold('Error syncing items with the ESOVBD.'));
        }
      }
    } else {
      console.error(chalk.bold('No videos retrieved from the ESOVBD.'));
    }
  } catch (err) {
    console.error(err);
    throw new Error(err);
  }
})();
