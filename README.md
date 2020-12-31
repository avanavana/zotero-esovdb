# zotero-esovdb

Gets a specified number of records from the ESOVDB (Earth Science Online Video Database), adds them as items in a Zotero library, and then re-syncs the new Zotero version number or newly assigned Zotero keys with the ESOVDB. Uses [avanavana/airtable-api-proxy](https://github.com/avanavana/airtable-api-proxy) for communicating with both the Airtable and Zotero APIs.

Visit the [The Earth Science Online Video Database](https://airtable.com/shrFBKQwGjstk7TVn)

To install as CLI:
`$ npm install -g zotero-esovdb`

Be sure to create a .env file that contains your own `ZOTERO_USER` and `ZOTERO_API_KEY` values, obtainable through the settings page of your Zotero account, and connect to your own instance of [avanavana/airtable-api-proxy](https://github.com/avanavana/airtable-api-proxy).

Usage:

```
Usage: zotvid [-m | --max-records <number>] [-p | --page-size <number>]
[(-C | --createdAfter <date>|-M | --modified-after <date>)] [-c | --chunk-size <number>]
[-w | --wait-secs <secs>] [-j | --json] [-s | --silent] [-v | --version] [-h | --help]

Gets a specified number of records from the ESOVDB (Earth Science Online Video Database), adds
them as items in a Zotero library, and then re-syncs the new Zotero version number or newly
assigned Zotero keys with the ESOVDB.  Uses airtable-api-proxy
(https://github.com/avanavana/airtable-api-proxy) for communicating with both the Airtable and
Zotero APIs.

Options:
  -v, --version                Displays the current version of zotlib.
  -m, --max-records <number>   Total number of items to add to Zotero. (default: all items)
  -p, --page-size <number>     Maximum number of items (≤100) to retrieve from ESOVDB for each
                               individual page request. (default: 100)
  -C, --created-after <date>   Include only records created after a specified date. Assumes GMT
                               if time is excluded—if included, zotvid uses the local timezone.
                               Excludes option -M --modified-after).
  -M, --modified-after <date>  Include only records modified after a specified date. Assumes GMT
                               if time is excluded—if included, zotvid uses the local timezone.
                               Excludes option -C --created-after).
  -c, --chunk-size <number>    Maxmimum number of items (≤50) to add to Zotero in a single request,
                               to avoid rate-limiting. (default: 50)
  -w, --wait-secs <secs>       Number of seconds to wait between Zotero requests, to avoid rate-
                               limiting. (default: 10)
  -j, --json                   Retrieve raw json without adding to Zotero.
  -s, --silent                 Run without any logging.
  -h, --help                   Display this help file.
```

MIT License
Copyright (c) 2020 Avana Vana
