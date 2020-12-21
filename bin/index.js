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
  .name('zotvid')
  .description(
    'Gets a specified number of records from the ESOVDB and adds them as items in a Zotero library'
  )
  .version(version || '1.0.0', '-v, --version', 'output the current version')
  .option(
    '-m, --max-records <number>',
    'total number of items to add to Zotero (default: all items)',
    (int) => parseInt(int)
  )
  .option(
    '-p, --page-size <number>',
    'number of items to get from ESOVDB in one request, ≤100 (default: 100)',
    (int) => parseInt(int > 100 ? 100 : int)
  )
  .option(
    '-C, --created-after <date>',
    'return only records created after a specified date',
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
    'return only records modified after a specified date',
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
    'number of items to add to Zotero in one request, ≤50',
    (int) => parseInt(int > 50 ? 50 : int),
    50
  )
  .option(
    '-w, --wait-secs <number>',
    'number of seconds to wait between Zotero requests',
    (int) => parseInt(int),
    10
  )
  .option('-j, --json', 'retrieve raw json without adding to Zotero')
  .option('-s, --silent', 'run without any logging');

const esovdbHeaders = {
  'User-Agent': 'zotero-esovdb/' + version || '1.0.0',
};

const zoteroHeaders = {
  Authorization: 'Bearer ' + process.env.ZOTERO_API_KEY,
  'Zotero-API-Version': '3',
  'User-Agent': 'zotero-esovdb/' + version || '1.0.0',
};

const zoteroLibrary = axios.create({
  baseURL: `https://api.zotero.org/users/${process.env.ZOTERO_USER}/`,
  headers: zoteroHeaders,
});

const zotero = axios.create({
  baseURL: 'https://api.zotero.org/',
  headers: zoteroHeaders,
});

zoteroLibrary.defaults.headers.post['Content-Type'] = 'application/json';

const esovdb = axios.create({
  baseURL: `https://${process.env.ESOVDB_PROXY_CACHE}.codeanyapp.com/esovdb/`,
  headers: esovdbHeaders,
});

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
        ? ', created after ' + decodeURIComponent(params.createdAtAfter)
        : ''
    }...`
  );

  try {
    const response = await esovdb.get('videos/list', { params: params });

    if (response) {
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

const addItems = async (items) => {
  try {
    const response = await zoteroLibrary.post('items', items);
    const successful = Object.values(response.data.successful);
    const failed = Object.values(response.data.failed);

    if (successful.length > 0) {
      log(
        chalk.green(
          `› Successfully added ${successful.length} item${
            successful.length > 1 ? 's' : ''
          }.`
        )
      );
    }

    if (failed.length > 0) {
      console.error(chalk.bold.red(`› Failed to add ${failed.length} videos.`));
      const failedItems = JSON.stringify(response.data.failed);

      fs.writeFile('failed.json', failedItems, 'utf8', (err) => {
        if (err) {
          console.error(
            chalk.bold.red(
              'An error occured while writing JSON Object to File.'
            )
          );
        }
      });
    }

    return { successful: successful, failed: failed };
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

  return {
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
};

(async () => {
  try {
    const params = {};
    program.parse(process.argv);
    if (program.maxRecords) params.maxRecords = program.maxRecords;
    if (program.pageSize) params.pageSize = program.pageSize;
    if (program.createdAfter) params.createdAfter = program.createdAfter;
    if (program.modifiedAfter) params.modifiedAfter = program.modifiedAfter;

    const videos = await getVideos(params);

    if (videos) {
      if (program.json) {
        const json = JSON.stringify(videos);

        fs.writeFileSync('videos.json', json, 'utf8', (err) => {
          if (err) {
            console.error(
              chalk.bold.red(
                'An error occured while writing JSON Object to File.'
              )
            );
          }
        });

        process.exit();
      }

      const template = await getTemplate();
      let items = videos.map((video) => formatItems(video, template));

      let i = 0,
        total = 0,
        queue = items.length;

      while (items.length > 0) {
        log(
          `Adding item${items.length > 1 ? 's' : ''} ${
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

        let { successful, failed } = await addItems(
          items.slice(0, program.chunkSize)
        );
        total += successful.length;
        if (items.length > program.chunkSize) await sleep(program.waitSecs);
        i++, (items = items.slice(program.chunkSize));
      }

      log(
        chalk.bold.green(`Added ${total} new items to Zotero from the ESOVDB.`)
      );
    } else {
      console.error(chalk.bold.red('No videos retrieved.'));
    }
  } catch (err) {
    console.error(err);
    throw new Error(err);
  }
})();
