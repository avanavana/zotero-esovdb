const chalk = require('chalk');
const { version } = require('./package.json');
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
    console.log(
      `  ${chalk.bold(
        '$'
      )} zotvid\n  Syncs all records in the ESOVDB with Zotero.\n`
    );
    console.log(
      `  ${chalk.bold(
        '$'
      )} zotvid -m 9 -p 3\n  Gets the latest 9 records in 3 separate Airtable API calls and syncs them with\n  a Zotero library.\n`
    );
    console.log(
      `  ${chalk.bold(
        '$'
      )} zotvid -M "2020-12-31 00:00 am"\n  Syncs all records modified since Dec 31, 2020 at midnight and syncs them with\n  a Zotero library.\n`
    );
    console.log(
      `  ${chalk.bold(
        '$'
      )} zotvid -j\n  Gets all records in the ESOVDB and downloads them to a json file.\n`
    );
  });

module.exports = { program };
