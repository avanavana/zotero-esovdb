# zotero-esovdb

Gets a specified number of records from the ESOVDB (Earth Science Online Video Database) and adds them as items in a Zotero library

Visit the [The Earth Science Online Video Database](https://airtable.com/shrFBKQwGjstk7TVn)

Client-side of [avanavana/airtable-api-proxy](https://github.com/avanavana/airtable-api-proxy).

To install as CLI:
`$ npm install -g zotero-esovdb`

Be sure to create a .env file that contains your own `ZOTERO_USER` and `ZOTERO_API_KEY` values, obtainable through the settings page of your Zotero account.

Usage:

```
Usage: zotvid [options]
Gets a specified number of records from the ESOVDB and add them as items in a Zotero library
Options:
  -v, --version               output the current version
  -m, --max-records <number>  total number of items to add to Zotero (default: all items)
  -p, --page-size <number>    number of items to get from ESOVDB in one request, ≤100 (default:
                              100)
  -c, --chunk-size <number>   number of items to add to Zotero in one request, ≤50 (default: 50)
  -w, --wait-secs <number>    number of seconds to wait between Zotero requests (default: 10)
  -j, --json                  retrieve raw json without adding to Zotero
  -s, --silent                run without any logging
  -h, --help                  display help for command
```

MIT License
Copyright (c) 2020 Avana Vana
