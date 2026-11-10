# KC3Kai remodel rules

`RemodelDb.js` is an unmodified MIT-licensed source snapshot from KC3Kai/KC3Kai,
commit `86db000bea84a1ee94fef4f61bd5173737359f5c` (2026-10-15).
Source: https://github.com/KC3Kai/KC3Kai/blob/86db000bea84a1ee94fef4f61bd5173737359f5c/src/library/modules/RemodelDb.js
Copyright and license are retained in LICENSE.

The build-time importer uses only calcDevMat/calcTorch/calcGunMat/calcScrew/
calcArsenalMat. It does not use browser globals, localStorage, mkDb, the
count-based cache, or KC3's default-zero handling for missing master data.
Update the source pin and vendor snapshot together and rerun adapter tests.
